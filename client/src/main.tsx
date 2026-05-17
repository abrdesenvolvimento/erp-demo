import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { warmUpAndLogin } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1, // Apenas 1 retry para queries (padrão é 3)
      retryDelay: 1000,
      staleTime: 30_000, // 30s - evita refetch desnecessário
      refetchOnWindowFocus: false, // Evita refetch ao voltar para a aba
    },
    mutations: {
      retry: false, // NUNCA fazer retry automático em mutations (causa duplicação)
    },
  },
});

// Debounced redirect: only redirect after multiple consecutive UNAUTHORIZED errors
// This prevents transient DB/network errors from causing login loops
let unauthorizedCount = 0;
let lastUnauthorizedTime = 0;
const UNAUTHORIZED_THRESHOLD = 3; // Need 3 consecutive errors
const UNAUTHORIZED_WINDOW_MS = 5000; // Within 5 seconds
let redirectPending = false;

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;
  if (redirectPending) return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) {
    // Non-auth error resets the counter
    return;
  }

  // If the logged_in marker exists, the user HAS a valid session.
  // The UNAUTHORIZED error is likely transient (cold start, DB timeout).
  // Do NOT redirect - let the useAuth retry logic handle it.
  const hasLoginMarker = document.cookie.includes('logged_in=1');
  if (hasLoginMarker) {
    console.warn('[Auth] UNAUTHORIZED error but logged_in marker exists - ignoring (transient)');
    return;
  }

  const now = Date.now();

  // Reset counter if too much time has passed since last error
  if (now - lastUnauthorizedTime > UNAUTHORIZED_WINDOW_MS) {
    unauthorizedCount = 0;
  }

  unauthorizedCount++;
  lastUnauthorizedTime = now;

  console.warn(`[Auth] UNAUTHORIZED error ${unauthorizedCount}/${UNAUTHORIZED_THRESHOLD}`);

  if (unauthorizedCount >= UNAUTHORIZED_THRESHOLD) {
    console.warn('[Auth] Multiple UNAUTHORIZED errors detected, redirecting to login');
    redirectPending = true;
    unauthorizedCount = 0;
    warmUpAndLogin();
  }
};

// Reset counter on successful queries (auth is working)
queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "success") {
    if (unauthorizedCount > 0) {
      unauthorizedCount = 0;
    }
  }
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

/**
 * Safari-safe fetch wrapper.
 * Safari throws "The string did not match the expected pattern" when
 * response.json() is called on a 204 No Content or empty-body response.
 * This wrapper intercepts the response and returns a safe JSON body
 * so tRPC/superjson never hits the Safari bug.
 */
async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  const companyId = document.cookie.match(/(?:^| )activeCompanyId=([^;]+)/)?.[1];
  const branchId = document.cookie.match(/(?:^| )activeBranchId=([^;]+)/)?.[1];
  if (companyId) headers.set('x-company-id', companyId);
  if (branchId) headers.set('x-branch-id', branchId);

  const response = await globalThis.fetch(input, {
    ...(init ?? {}),
    credentials: "include",
    headers,
  });

  // Guard against Safari's 204/empty-body .json() bug:
  // If status is 204 or content-length is 0, return a synthetic response
  // with an empty JSON array (tRPC batch expects an array).
  const contentLength = response.headers.get('content-length');
  if (response.status === 204 || contentLength === '0') {
    return new Response('[{"result":{"data":{"json":null}}}]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return response;
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: safeFetch,
    }),
  ],
});

// Register Service Worker for OAuth callback 503 retry
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw-auth.js', { scope: '/' })
    .then(reg => console.log('[SW] Auth retry worker registered', reg.scope))
    .catch(err => console.warn('[SW] Registration failed:', err));
  
  // Listen for retry messages from SW
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'oauth-retry') {
      console.log(`[SW] OAuth callback retry ${event.data.attempt}/${event.data.maxRetries}`);
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
