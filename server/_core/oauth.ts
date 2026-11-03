import { COOKIE_NAME } from "@shared/const";
import type { Express, Request, Response } from "express";
import { parse } from "cookie";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { createOperatorSession, revokeOperatorSession } from "../operatorSecurity";
import { decodeBrowserOAuthState, OAUTH_BROWSER_NONCE_COOKIE } from "../../shared/oauthState";
import { isAnniversaryMonth } from "../../shared/sessionSecurity";

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
    if (!code || !decoded || !expected || decoded.nonce !== expected) {
      res.status(403).send("Solicitação de login inválida ou expirada. Volte ao ABRWF e inicie um novo login.");
      return;
    }
    // Consumo único da prova do navegador antes da troca do código.
    res.clearCookie(OAUTH_BROWSER_NONCE_COOKIE, { path: "/", secure: true, sameSite: "lax" });
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
      res.type("html").status(200).send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entrando no ABRWF</title><meta http-equiv="refresh" content="2;url=/"><style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#143640;color:#f4f5f1;font-family:system-ui,sans-serif}main{padding:32px;max-width:440px;text-align:center}img{width:76px;height:76px;object-fit:contain}h1{font-size:22px}p{line-height:1.6;color:#d5e1df}.line{height:2px;background:#d4af37;transform-origin:left;animation:reveal .24s ease-out}.muted{font-size:13px}@keyframes reveal{from{opacity:0;transform:scaleX(.95)}to{opacity:1;transform:scaleX(1)}}@media(prefers-reduced-motion:reduce){.line{animation:none}}
      </style></head><body><main><img src="/logo-abrwf.png" alt="ABRWF"><h1>${anniversary ? "ABRWF — 1 ano de evolução" : "Bem-vindo ao ABRWF"}</h1><div class="line"></div>${anniversary ? "<p>Um ano transformando rotina em controle e dados em decisões.</p><p class=\"muted\">Novembro de 2025 — Novembro de 2026</p>" : ""}<p>Confirmando seu acesso individual...</p></main><script>setTimeout(function(){location.replace('/')},1200)</script></body></html>`);
    } catch (error) {
      console.error("[OAuth] Não foi possível concluir o login:", error instanceof Error ? error.message : "falha de autenticação");
      res.status(500).type("html").send('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Login ABRWF</title><body style="font-family:system-ui;padding:32px"><h1>Não foi possível concluir o login</h1><p>Volte ao sistema e inicie uma nova tentativa. Nenhuma operação foi autorizada.</p><a href="/">Voltar ao ABRWF</a></body></html>');
    }
  });
}
