import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, gt } from "drizzle-orm";
import { parse } from "cookie";
import type { Request, Response } from "express";
import type { User } from "../drizzle/schema";
import { productionTerminals, userCompanies, securityEvents, companies } from "../drizzle/schema";
import { getDb } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { TRPCError } from "@trpc/server";

export const PRODUCTION_COOKIE = "abrwf_production_terminal";
const TERM_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const PRODUCTION_READ_PATHS = new Set(["salon.getKDSItems", "salon.getKDSStats"]);
const digest = (token: string) => createHash("sha256").update(token).digest("hex");

async function requireCompanyAdmin(user: User, companyId: number | undefined) {
  if (!companyId || user.role !== "admin" || user.blocked) throw new TRPCError({ code: "FORBIDDEN", message: "Administrador e empresa ativa necessários." });
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível.");
  const [access] = await db.select().from(userCompanies).where(and(eq(userCompanies.userId, user.id), eq(userCompanies.companyId, companyId))).limit(1);
  const [company] = await db.select().from(companies).where(and(eq(companies.id, companyId), eq(companies.active, true))).limit(1);
  if (!access || access.role !== "admin" || !company) throw new TRPCError({ code: "FORBIDDEN", message: "Sem acesso administrativo à empresa." });
  return db;
}

export async function enableProductionTerminal(user: User, companyId: number | undefined, name: string, req: Request, res: Response) {
  const db = await requireCompanyAdmin(user, companyId);
  const old = await readProductionTerminal(req);
  if (old) await db.update(productionTerminals).set({ revokedAt: new Date() }).where(eq(productionTerminals.id, old.id));
  const id = randomUUID();
  const secret = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TERM_DURATION_MS);
  await db.insert(productionTerminals).values({ id, companyId: companyId!, name: name.trim(), tokenHash: digest(secret), createdBy: user.id, expiresAt });
  await db.insert(securityEvents).values({ userId: user.id, companyId: companyId!, event: "TERMINAL_PRODUCAO_ATIVADO", details: JSON.stringify({ terminalId: id, name: name.trim() }) });
  res.cookie(PRODUCTION_COOKIE, `${id}.${secret}`, { ...getSessionCookieOptions(req), maxAge: TERM_DURATION_MS });
  return { success: true } as const;
}

export function matchesProductionSecret(secret: string, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(expected)) return false;
  return timingSafeEqual(Buffer.from(digest(secret), "hex"), Buffer.from(expected, "hex"));
}

export async function readProductionTerminal(req: Request) {
  const value = parse(req.headers.cookie ?? "")[PRODUCTION_COOKIE];
  if (!value || value.length > 180) return null;
  const [id, secret, extra] = value.split(".");
  if (!id || !secret || extra) return null;
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível.");
  const [terminal] = await db.select().from(productionTerminals).where(and(eq(productionTerminals.id, id), isNull(productionTerminals.revokedAt), gt(productionTerminals.expiresAt, new Date()))).limit(1);
  if (!terminal || !matchesProductionSecret(secret, terminal.tokenHash)) return null;
  const [company] = await db.select({ id: companies.id }).from(companies).where(and(eq(companies.id, terminal.companyId), eq(companies.active, true))).limit(1);
  return company ? { id: terminal.id, name: terminal.name, companyId: terminal.companyId } : null;
}

export async function listProductionTerminals(user: User, companyId: number | undefined) {
  const db = await requireCompanyAdmin(user, companyId);
  return db.select({ id: productionTerminals.id, name: productionTerminals.name, companyId: productionTerminals.companyId, expiresAt: productionTerminals.expiresAt, revokedAt: productionTerminals.revokedAt }).from(productionTerminals).where(eq(productionTerminals.companyId, companyId!));
}

export async function revokeProductionTerminal(user: User, companyId: number | undefined, terminalId: string) {
  const db = await requireCompanyAdmin(user, companyId);
  await db.update(productionTerminals).set({ revokedAt: new Date() }).where(and(eq(productionTerminals.id, terminalId), eq(productionTerminals.companyId, companyId!)));
  await db.insert(securityEvents).values({ userId: user.id, companyId: companyId!, event: "TERMINAL_PRODUCAO_REVOGADO", details: JSON.stringify({ terminalId }) });
  return { success: true } as const;
}

export function productionRequestAllowed(path: string, type: string, companyId: unknown, terminalCompanyId: number): boolean {
  return type === "query" && PRODUCTION_READ_PATHS.has(path) && companyId === terminalCompanyId;
}
