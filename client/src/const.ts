export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "ERP Adega Beira Rio";

export const APP_LOGO = "/logo-abrwf.png";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

/**
 * Warm up the server before redirecting to OAuth.
 * Pings /api/ping with aggressive retry to ensure the Cloud Run container
 * is fully initialized before the OAuth flow begins.
 * Uses 15s timeout per attempt to handle cold starts that take 10+ seconds.
 */
export const warmUpAndLogin = async () => {
  const loginUrl = getLoginUrl();
  
  // Show a visual indicator that we're warming up
  const overlay = document.createElement('div');
  overlay.id = 'warmup-overlay';
  overlay.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;z-index:99999;font-family:system-ui,-apple-system,sans-serif;">
      <div style="text-align:center;">
        <div style="width:40px;height:40px;border:4px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;"></div>
        <p style="color:#6b7280;font-size:14px;margin:0;">Conectando ao servidor...</p>
      </div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `;
  document.body.appendChild(overlay);
  
  let serverReady = false;
  
  // Try to ping the server with aggressive retry
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const controller = new AbortController();
      // 15 second timeout - enough for cold start
      const timeout = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch('/api/ping', { 
        signal: controller.signal,
        credentials: 'include',
        // Bypass cache to ensure we hit the actual server
        cache: 'no-store',
      });
      clearTimeout(timeout);
      
      if (response.ok) {
        console.log(`[WarmUp] Server is ready (attempt ${attempt + 1})`);
        serverReady = true;
        break;
      }
    } catch (e) {
      console.log(`[WarmUp] Ping attempt ${attempt + 1}/4 failed, ${attempt < 3 ? 'retrying...' : 'proceeding anyway'}`);
      // Short delay before retry
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }
  
  // If server responded, wait a tiny bit more to ensure it's fully ready
  if (serverReady) {
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Remove overlay and redirect to OAuth
  overlay.remove();
  window.location.href = loginUrl;
};
