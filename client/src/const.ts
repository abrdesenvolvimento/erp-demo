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
 * This ensures the Cloud Run container is active when the OAuth callback returns.
 * Retries up to 3 times with increasing timeout to handle cold starts.
 */
export const warmUpAndLogin = async () => {
  const loginUrl = getLoginUrl();
  
  // Try to ping the server up to 3 times to ensure it's warm
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      // Increase timeout with each attempt: 5s, 10s, 15s
      const timeout = setTimeout(() => controller.abort(), 5000 + (attempt * 5000));
      
      const response = await fetch('/api/ping', { 
        signal: controller.signal,
        credentials: 'include' 
      });
      clearTimeout(timeout);
      
      if (response.ok) {
        console.log(`[WarmUp] Server is ready (attempt ${attempt + 1})`);
        break; // Server is warm, proceed to login
      }
    } catch (e) {
      console.log(`[WarmUp] Ping attempt ${attempt + 1} failed, ${attempt < 2 ? 'retrying...' : 'proceeding anyway'}`);
      // Small delay before retry
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  
  // Now redirect to OAuth - container should be warm
  window.location.href = loginUrl;
};
