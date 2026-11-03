export const OAUTH_BROWSER_NONCE_COOKIE = "__Host-abrwf_oauth_nonce";
export type BrowserOAuthState = { redirectUri: string; nonce: string };
export function encodeBrowserOAuthState(state: BrowserOAuthState): string {
  return btoa(JSON.stringify(state));
}
export function decodeBrowserOAuthState(raw: string): BrowserOAuthState | null {
  try {
    if (raw.length > 4096) return null;
    const value = JSON.parse(atob(raw));
    if (typeof value.redirectUri !== "string" || typeof value.nonce !== "string" || !/^[a-f0-9-]{36}$/i.test(value.nonce)) return null;
    const url = new URL(value.redirectUri);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) return null;
    if (url.pathname !== "/api/oauth/callback" || url.search || url.hash || url.username || url.password) return null;
    return { redirectUri: url.href, nonce: value.nonce };
  } catch { return null; }
}
export function isBrowserOAuthStateValid(raw: string, expected: string | undefined): boolean {
  const decoded = decodeBrowserOAuthState(raw);
  return Boolean(decoded && expected && decoded.nonce === expected);
}
