import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
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
    res.json({
      protocol: req.protocol,
      secure: req.secure,
      hostname: req.hostname,
      host: req.get('host'),
      xForwardedProto: req.headers['x-forwarded-proto'],
      xForwardedFor: req.headers['x-forwarded-for'],
      xForwardedHost: req.headers['x-forwarded-host'],
      origin: req.headers['origin'],
      cookieOptions: getSessionCookieOptions(req),
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

    console.log(`[OAuth] Callback received - code length: ${code?.length || 0}, retry: ${retryCount}`);

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
      res.redirect(302, "/");
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      const errMsg = error?.response?.data ? JSON.stringify(error.response.data) : error?.message || String(error);
      const errStatus = error?.response?.status || 'unknown';
      console.error(`[OAuth] Callback FAILED after ${elapsed}ms - Status: ${errStatus}, Error: ${errMsg}, Retry: ${retryCount}`);

      // If this is a cold start issue (token expired/invalid), redirect back to login
      // The container is now warm, so the next attempt should succeed
      if (retryCount < 2) {
        // Redirect back to the OAuth login page to get a fresh code
        const appId = ENV.appId || process.env.VITE_APP_ID;
        const origin = `${req.protocol}://${req.get('host')}`;
        const redirectUri = `${origin}/api/oauth/callback`;
        const oauthPortalUrl = process.env.VITE_OAUTH_PORTAL_URL || 'https://manus.im/app-auth';
        const newState = Buffer.from(redirectUri).toString('base64');
        const loginUrl = `${oauthPortalUrl}?appId=${appId}&redirectUri=${encodeURIComponent(redirectUri)}&state=${newState}&type=signIn`;
        
        console.log(`[OAuth] Redirecting to login for retry (attempt ${retryCount + 1})`);
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
