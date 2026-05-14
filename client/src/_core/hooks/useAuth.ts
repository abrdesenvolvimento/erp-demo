import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

/**
 * Check if the non-httpOnly marker cookie "logged_in" exists.
 * This marker is set alongside the httpOnly session cookie during OAuth callback.
 * Since the session cookie is httpOnly, JavaScript cannot read it directly.
 */
function hasLoginMarker(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.includes('logged_in=1');
}

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();
  const retryCountRef = useRef(0);
  const maxRetries = 4; // More retries to handle cold start
  const [isRetrying, setIsRetrying] = useState(false);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: (failureCount, error) => {
      // Retry on network errors or 5xx errors (cold start)
      if (error instanceof TRPCClientError) {
        const httpStatus = error.data?.httpStatus;
        if (httpStatus && httpStatus >= 500) return failureCount < 3;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * (attemptIndex + 1), 5000),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  // If auth.me returns null but we have the login marker cookie, retry automatically.
  // This handles transient DB failures during cold start.
  useEffect(() => {
    if (meQuery.isLoading || meQuery.isFetching) return;
    
    // If we got a user, reset retry count
    if (meQuery.data) {
      retryCountRef.current = 0;
      setIsRetrying(false);
      return;
    }

    // If auth.me returned null (no user), check if we have the login marker
    if (hasLoginMarker() && retryCountRef.current < maxRetries) {
      // We have a marker cookie but auth failed - likely a transient error (cold start)
      retryCountRef.current++;
      setIsRetrying(true);
      console.warn(`[Auth] Login marker exists but auth.me returned null. Retry ${retryCountRef.current}/${maxRetries}`);
      
      // Exponential backoff: 1s, 2s, 3s, 4s
      const delay = 1000 * retryCountRef.current;
      const timer = setTimeout(() => {
        meQuery.refetch();
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setIsRetrying(false);
    }
  }, [meQuery.data, meQuery.isLoading, meQuery.isFetching]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      // Clear the login marker cookie
      document.cookie = "logged_in=;path=/;max-age=0";
      // Clear company cookies
      document.cookie = "activeCompanyId=;path=/;max-age=0";
      document.cookie = "activeBranchId=;path=/;max-age=0";
      retryCountRef.current = maxRetries; // Don't retry after explicit logout
      setIsRetrying(false);
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || meQuery.isFetching || logoutMutation.isPending || isRetrying,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    meQuery.isFetching,
    logoutMutation.error,
    logoutMutation.isPending,
    isRetrying,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending || isRetrying) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
    isRetrying,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
