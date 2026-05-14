import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions, getCanonicalOrigin } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // Trust proxy - required for correct req.protocol behind Cloud Run/Cloudflare
  app.set('trust proxy', true);

  // Debug endpoint to check request headers (temporary)
  app.get("/api/debug/headers", (req: Request, res: Response) => {
    const cookies = req.headers.cookie;
    const hasCookie = cookies ? cookies.includes(COOKIE_NAME) : false;
    res.json({
      protocol: req.protocol,
      secure: req.secure,
      hostname: req.hostname,
      host: req.get('host'),
      xForwardedProto: req.headers['x-forwarded-proto'],
      xForwardedFor: req.headers['x-forwarded-for'],
      xForwardedHost: req.headers['x-forwarded-host'],
      origin: req.headers['origin'],
      referer: req.headers['referer'],
      canonicalOrigin: getCanonicalOrigin(req),
      cookieOptions: getSessionCookieOptions(req),
      cookieHeader: cookies ? `${cookies.substring(0, 50)}...` : null,
      hasSessionCookie: hasCookie,
      allCookieNames: cookies ? cookies.split(';').map(c => c.trim().split('=')[0]) : [],
    });
  });

  // Cookie test: Step 1 - Set a test cookie and redirect
  app.get("/api/debug/cookie-set", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie('debug_test', 'cookie_works_' + Date.now(), { ...cookieOptions, maxAge: 60000 });
    console.log(`[Debug] Setting test cookie with options: ${JSON.stringify(cookieOptions)}`);
    res.redirect(302, '/api/debug/cookie-check');
  });

  // Cookie test: Step 2 - Check if the test cookie was received
  app.get("/api/debug/cookie-check", (req: Request, res: Response) => {
    const cookies = req.headers.cookie;
    const hasDebugCookie = cookies ? cookies.includes('debug_test') : false;
    const hasSessionCookie = cookies ? cookies.includes(COOKIE_NAME) : false;
    res.json({
      cookieHeader: cookies || null,
      hasDebugCookie,
      hasSessionCookie,
      allCookieNames: cookies ? cookies.split(';').map(c => c.trim().split('=')[0]) : [],
      message: hasDebugCookie 
        ? 'Cookie test PASSED - cookies work correctly'
        : 'Cookie test FAILED - browser is not sending cookies back',
    });
  });

  // Health/keep-alive endpoint - lightweight, no DB
  app.get("/api/oauth/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Keep-alive ping endpoint - used by external cron to prevent cold starts
  app.get("/api/ping", (req: Request, res: Response) => {
    res.status(200).send("pong");
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const retryCount = parseInt(getQueryParam(req, "retry") || "0");
    const startTime = Date.now();

    // Derive the canonical public origin for this request
    const canonicalOrigin = getCanonicalOrigin(req);
    console.log(`[OAuth] Callback received - code length: ${code?.length || 0}, retry: ${retryCount}, canonicalOrigin: ${canonicalOrigin}, host: ${req.get('host')}`);

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const t1 = Date.now();
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      console.log(`[OAuth] Token exchange done in ${Date.now() - t1}ms`);

      const t2 = Date.now();
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      console.log(`[OAuth] User info done in ${Date.now() - t2}ms - openId: ${userInfo.openId}`);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      const t3 = Date.now();
      await db.upsertUser({
        id: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });
      console.log(`[OAuth] Upsert done in ${Date.now() - t3}ms`);

      const t4 = Date.now();
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      console.log(`[OAuth] Session token done in ${Date.now() - t4}ms`);

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      console.log(`[OAuth] Callback completed successfully in ${Date.now() - startTime}ms`);
      console.log(`[OAuth] Cookie options: ${JSON.stringify(cookieOptions)}`);
      console.log(`[OAuth] Token length: ${sessionToken.length}`);

      // IMPORTANT: Do NOT use 302 redirect here.
      // iOS WKWebView (in-app browsers) often drops Set-Cookie headers from 302 responses.
      // Instead, send an HTML page that:
      // 1. Receives the Set-Cookie header in a 200 response (browser stores it)
      // 2. Uses JavaScript/meta-refresh to navigate to / after a small delay
      // This ensures the cookie is properly stored before navigation.
      res.status(200).send(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Entrando...</title>
<meta http-equiv="refresh" content="1;url=/">
<style>
  body { display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; font-family:system-ui,-apple-system,sans-serif; background:#f8f9fa; }
  .loader { text-align:center; }
  .spinner { width:40px; height:40px; border:4px solid #e5e7eb; border-top-color:#2563eb; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 16px; }
  @keyframes spin { to { transform:rotate(360deg); } }
  p { color:#6b7280; font-size:14px; }
</style>
</head><body>
<div class="loader">
  <div class="spinner"></div>
  <p>Entrando no sistema...</p>
</div>
<script>
  // Navigate after a brief delay to ensure cookie is stored
  setTimeout(function() { window.location.replace('/'); }, 500);
</script>
</body></html>`);
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      const errMsg = error?.response?.data ? JSON.stringify(error.response.data) : error?.message || String(error);
      const errStatus = error?.response?.status || 'unknown';
      console.error(`[OAuth] Callback FAILED after ${elapsed}ms - Status: ${errStatus}, Error: ${errMsg}, Retry: ${retryCount}`);

      // If this is a cold start issue (token expired/invalid), redirect back to login
      // The container is now warm, so the next attempt should succeed
      if (retryCount < 2) {
        // Use the STATE parameter to recover the original public redirectUri
        // The state is base64(redirectUri) - decode it to get the original callback URL
        let publicRedirectUri: string;
        try {
          const decodedState = Buffer.from(state, 'base64').toString('utf-8');
          // If the decoded state looks like a valid URL, use its origin
          if (decodedState.startsWith('http')) {
            const stateUrl = new URL(decodedState);
            publicRedirectUri = `${stateUrl.origin}/api/oauth/callback`;
          } else {
            publicRedirectUri = `${canonicalOrigin}/api/oauth/callback`;
          }
        } catch {
          publicRedirectUri = `${canonicalOrigin}/api/oauth/callback`;
        }

        const appId = ENV.appId || process.env.VITE_APP_ID;
        const oauthPortalUrl = process.env.VITE_OAUTH_PORTAL_URL || 'https://manus.im/app-auth';
        const newState = Buffer.from(publicRedirectUri).toString('base64');
        const loginUrl = `${oauthPortalUrl}?appId=${appId}&redirectUri=${encodeURIComponent(publicRedirectUri)}&state=${newState}&type=signIn&retry=${retryCount + 1}`;
        
        console.log(`[OAuth] Redirecting to login for retry (attempt ${retryCount + 1}), redirectUri: ${publicRedirectUri}`);
        res.redirect(302, loginUrl);
      } else {
        // After 2 retries, show error page
        res.status(500).send(`
          <!DOCTYPE html>
          <html>
          <head><title>Erro de Login</title><meta charset="utf-8"></head>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5;">
            <div style="text-align: center; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 400px;">
              <h2 style="color: #333;">Erro ao fazer login</h2>
              <p style="color: #666;">O servidor demorou para responder. Por favor, tente novamente.</p>
              <a href="/" style="display: inline-block; margin-top: 1rem; padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">Tentar novamente</a>
            </div>
          </body>
          </html>
        `);
      }
    }
  });
}
