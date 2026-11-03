export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { encodeBrowserOAuthState, OAUTH_BROWSER_NONCE_COOKIE } from "@shared/oauthState";
import { createLoginSingleFlight } from "./lib/loginSingleFlight";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "ERP Adega Beira Rio";
export const APP_LOGO = "/logo-abrwf.png";

const loginFlight = createLoginSingleFlight();
export const isLoginInProgress = () => loginFlight.isPending();

// Only call immediately before navigation: every request has its own browser proof.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_BROWSER_NONCE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  const proofWritten = document.cookie.split(";").some(cookie => cookie.trim() === `${OAUTH_BROWSER_NONCE_COOKIE}=${nonce}`);
  if (!proofWritten) {
    throw new Error("Este contexto não permite validar o login. Abra o ABRWF diretamente no navegador e permita cookies para continuar.");
  }
  const state = encodeBrowserOAuthState({ redirectUri, nonce });
  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");
  return url.toString();
};

/** Acquires the shared lock BEFORE logout; creates state only AFTER warm-up. */
export const warmUpAndLogin = (beforeLogin?: () => Promise<void>): Promise<void> => loginFlight.run(async () => {
  const overlay = document.createElement("div");
  overlay.id = "warmup-overlay";
  overlay.innerHTML = `<div style="position:fixed;inset:0;background:rgba(249,250,246,.96);display:flex;align-items:center;justify-content:center;z-index:99999;font-family:system-ui,-apple-system,sans-serif;"><p style="color:#154c44;font-size:14px;">Conectando ao servidor...</p></div>`;
  document.body.appendChild(overlay);
  try {
    await beforeLogin?.();
    let serverReady = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await fetch("/api/ping", { signal: controller.signal, credentials: "include", cache: "no-store" });
        if (response.ok) {
          serverReady = true;
          break;
        }
      } catch {
        // Retry the harmless health check, NEVER an OAuth callback/code.
      } finally {
        clearTimeout(timer);
      }
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1500));
    }
    if (serverReady) await new Promise(resolve => setTimeout(resolve, 200));
    const loginUrl = getLoginUrl();
    window.location.assign(loginUrl);
  } finally {
    overlay.remove();
  }
});
