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
 * Returns a promise that resolves when the server is ready (or after timeout).
 */
export const warmUpAndLogin = async () => {
  const loginUrl = getLoginUrl();
  
  try {
    // Ping the server to wake up the container (fire and forget with timeout)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    await fetch('/api/ping', { 
      signal: controller.signal,
      credentials: 'include' 
    });
    clearTimeout(timeout);
  } catch (e) {
    // If ping fails, still redirect - the container might wake up in time
    console.log('[WarmUp] Server ping failed, proceeding with login anyway');
  }
  
  // Now redirect to OAuth - container should be warm
  window.location.href = loginUrl;
};
