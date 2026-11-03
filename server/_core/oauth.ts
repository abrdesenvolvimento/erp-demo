import { COOKIE_NAME } from "@shared/const";
import type { Express, Request, Response } from "express";
import { parse } from "cookie";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { createOperatorSession, revokeOperatorSession } from "../operatorSecurity";
import { decodeBrowserOAuthState, OAUTH_BROWSER_NONCE_COOKIE } from "../../shared/oauthState";
import { isAnniversaryMonth } from "../../shared/sessionSecurity";
import { renderOAuthSuccessPage } from "../anniversaryBrand";
import { renderOAuthRecoveryPage } from "../oauthRecovery";

const IDENTITY_COOKIE_MS = 48 * 60 * 60 * 1000;

export function registerOAuthRoutes(app: Express) {
  app.set("trust proxy", true);
  // Removidos os endpoints públicos de depuração que revelavam cookies/dados de autenticação.
  app.get("/api/oauth/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() }));
  app.get("/api/ping", (_req, res) => res.status(200).send("pong"));

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const decoded = decodeBrowserOAuthState(state);
    const expected = parse(req.headers.cookie ?? "")[OAUTH_BROWSER_NONCE_COOKIE];
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (!code || !decoded || !expected || decoded.nonce !== expected) {
      // Somente categorias fixas: nunca registrar valores do callback ou cookies.
      const reason = !code ? "missing-code" : !decoded ? "malformed-state" : !expected ? "missing-nonce" : "nonce-mismatch";
      console.warn("[OAuth] Login rejeitado:", reason);
      res.status(403).type("html").send(renderOAuthRecoveryPage());
      return;
    }
    // Consumo único da prova do navegador antes da troca do código.
    res.clearCookie(OAUTH_BROWSER_NONCE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const token = await sdk.exchangeCodeForToken(code, state);
      const info = await sdk.getUserInfo(token.accessToken);
      if (!info.openId) throw new Error("O provedor não identificou o usuário.");
      await db.upsertUser({ id: info.openId, name: info.name || null, email: info.email ?? null, loginMethod: info.loginMethod ?? info.platform ?? null, lastSignedIn: new Date() });
      const user = await db.getUser(info.openId);
      if (!user || user.blocked) {
        res.status(403).send("Usuário bloqueado ou indisponível. Contate o administrador.");
        return;
      }
      // Substitui/revoga a identidade anterior deste navegador, inclusive quando OAuth usa SSO.
      const oldToken = parse(req.headers.cookie ?? "")[COOKIE_NAME];
      const oldIdentity = await sdk.verifySession(oldToken);
      if (oldIdentity?.operatorSessionId) await revokeOperatorSession(oldIdentity.openId, oldIdentity.operatorSessionId);
      const operatorSessionId = await createOperatorSession(user.id, String(req.headers["user-agent"] ?? "").slice(0, 255));
      const identity = await sdk.createSessionToken(user.id, { name: user.name || "Operador", operatorSessionId, expiresInMs: IDENTITY_COOKIE_MS });
      const opts = getSessionCookieOptions(req);
      // O cookie de identidade não concede acesso: sessão no banco vence no próximo corte diário.
      res.cookie(COOKIE_NAME, identity, { ...opts, maxAge: IDENTITY_COOKIE_MS });
      res.cookie("logged_in", "1", { path: "/", sameSite: "lax", secure: opts.secure, httpOnly: false, maxAge: IDENTITY_COOKIE_MS });
      res.clearCookie("activeCompanyId", { path: "/" });
      res.clearCookie("activeBranchId", { path: "/" });
      const anniversary = isAnniversaryMonth(Date.now());
      // HTTP 200 preserva Set-Cookie em Safari/iOS; não reutiliza callback nem código em retry.
      res.type("html").status(200).send(renderOAuthSuccessPage(anniversary));
    } catch {
      // Erros do SDK podem carregar URL, código ou tokens; não registrar detalhes.
      console.error("[OAuth] Não foi possível concluir o login.");
      res.status(500).type("html").send('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Login ABRWF</title><body style="font-family:system-ui;padding:32px"><h1>Não foi possível concluir o login</h1><p>Volte ao sistema e inicie uma nova tentativa. Nenhuma operação foi autorizada.</p><a href="/">Voltar ao ABRWF</a></body></html>');
    }
  });
}
