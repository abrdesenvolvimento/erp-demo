import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useRef } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();
  const retryCountRef = useRef(0);
  const maxRetries = 2;

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    // Stale time: keep the result for 30 seconds before refetching
    staleTime: 30_000,
  });

  // If auth.me returns null but we have a session cookie, retry automatically
  // This handles transient DB failures during cold start
  useEffect(() => {
    if (meQuery.isLoading || meQuery.isFetching) return;
    
    // If we got a user, reset retry count
    if (meQuery.data) {
      retryCountRef.current = 0;
      return;
    }

    // If auth.me returned null (no user), check if we have a session cookie
    const hasSessionCookie = document.cookie.includes('app_session_id');
    if (hasSessionCookie && retryCountRef.current < maxRetries) {
      // We have a cookie but auth failed - likely a transient error
      // Retry after a short delay
      retryCountRef.current++;
      console.warn(`[Auth] Session cookie exists but auth.me returned null. Retry ${retryCountRef.current}/${maxRetries}`);
      const timer = setTimeout(() => {
        meQuery.refetch();
      }, 1000 * retryCountRef.current); // 1s, 2s delay
      return () => clearTimeout(timer);
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
      // Limpar cookies de empresa ativa para forçar tela de seleção no próximo login
      document.cookie = "activeCompanyId=;path=/;max-age=0";
      document.cookie = "activeBranchId=;path=/;max-age=0";
      retryCountRef.current = maxRetries; // Don't retry after explicit logout
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    
    // Consider "loading" if we have a session cookie but no user yet and haven't exhausted retries
    const hasSessionCookie = typeof document !== 'undefined' && document.cookie.includes('app_session_id');
    const isRetrying = !meQuery.data && hasSessionCookie && retryCountRef.current < maxRetries;
    
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
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
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
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
