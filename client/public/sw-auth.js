/**
 * Service Worker: Auth Callback 503 Retry
 * 
 * This service worker intercepts requests to /api/oauth/callback.
 * If Cloud Run returns 503 (Service Unavailable) due to cold start,
 * it retries the request with exponential backoff until the server is ready.
 * 
 * This is transparent to the user - they see the page loading while
 * the service worker handles the retry logic in the background.
 */

const MAX_RETRIES = 5;
const INITIAL_DELAY = 2000; // 2 seconds

self.addEventListener('install', (event) => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only intercept OAuth callback requests and ping
  if (url.pathname === '/api/oauth/callback') {
    event.respondWith(fetchWithRetry(event.request, 0));
  }
});

async function fetchWithRetry(request, attempt) {
  try {
    // First, try to wake up the server with a ping
    if (attempt > 0) {
      try {
        const pingUrl = new URL('/api/ping', request.url);
        await fetch(pingUrl.toString(), { 
          method: 'GET',
          credentials: 'include' 
        });
      } catch (e) {
        // Ping failed, but we'll try the callback anyway
      }
    }

    const response = await fetch(request.clone());
    
    // If we get 503 and haven't exhausted retries, wait and retry
    if (response.status === 503 && attempt < MAX_RETRIES) {
      const delay = INITIAL_DELAY * Math.pow(1.5, attempt);
      console.log(`[SW] OAuth callback returned 503. Retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
      
      // Notify the client about the retry
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'oauth-retry',
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
        });
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(request, attempt + 1);
    }
    
    return response;
  } catch (error) {
    // Network error - retry
    if (attempt < MAX_RETRIES) {
      const delay = INITIAL_DELAY * Math.pow(1.5, attempt);
      console.log(`[SW] OAuth callback network error. Retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(request, attempt + 1);
    }
    
    // All retries exhausted - return a friendly error page
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head><title>Erro de Login</title><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      </head>
      <body style="font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f9fa;">
        <div style="text-align:center;padding:2rem;background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:400px;">
          <h2 style="color:#333;">Servidor indisponível</h2>
          <p style="color:#666;">O servidor está demorando para inicializar. Tente novamente em alguns segundos.</p>
          <button onclick="window.location.reload()" style="margin-top:1rem;padding:0.75rem 1.5rem;background:#2563eb;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;">Tentar novamente</button>
        </div>
      </body>
      </html>
    `, {
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}
