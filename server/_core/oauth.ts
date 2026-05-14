import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // Diagnostic endpoint to check OAuth health
  app.get("/api/oauth/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const startTime = Date.now();

    console.log(`[OAuth] Callback received - code length: ${code?.length || 0}, state: ${state?.substring(0, 20)}...`);

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      console.log(`[OAuth] Step 1: Exchanging code for token...`);
      const t1 = Date.now();
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      console.log(`[OAuth] Step 1 done in ${Date.now() - t1}ms`);

      console.log(`[OAuth] Step 2: Getting user info...`);
      const t2 = Date.now();
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      console.log(`[OAuth] Step 2 done in ${Date.now() - t2}ms - openId: ${userInfo.openId}`);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      console.log(`[OAuth] Step 3: Upserting user...`);
      const t3 = Date.now();
      await db.upsertUser({
        id: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });
      console.log(`[OAuth] Step 3 done in ${Date.now() - t3}ms`);

      console.log(`[OAuth] Step 4: Creating session token...`);
      const t4 = Date.now();
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      console.log(`[OAuth] Step 4 done in ${Date.now() - t4}ms`);

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      console.log(`[OAuth] Callback completed successfully in ${Date.now() - startTime}ms`);
      res.redirect(302, "/");
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      const errMsg = error?.response?.data ? JSON.stringify(error.response.data) : error?.message || String(error);
      const errStatus = error?.response?.status || 'unknown';
      console.error(`[OAuth] Callback FAILED after ${elapsed}ms - Status: ${errStatus}, Error: ${errMsg}`);
      console.error(`[OAuth] Full error:`, error);
      res.status(500).json({ 
        error: "OAuth callback failed", 
        detail: errMsg, 
        status: errStatus,
        elapsed: `${elapsed}ms`
      });
    }
  });
}
