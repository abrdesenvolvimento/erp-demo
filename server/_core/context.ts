import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  activeCompanyId: number | undefined;
  activeBranchId: number | undefined;
};

// In-memory auth log for debugging (stores last 50 attempts)
interface AuthLogEntry {
  timestamp: string;
  hasCookie: boolean;
  cookieLength: number;
  success: boolean;
  userId: string | null;
  error: string | null;
  path: string;
  userAgent: string;
}

const AUTH_LOG: AuthLogEntry[] = [];
const MAX_LOG_ENTRIES = 50;

export function getAuthLog() {
  return AUTH_LOG.slice();
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  const hasCookie = !!opts.req.headers.cookie?.includes('app_session_id');
  const cookieLength = opts.req.headers.cookie?.length || 0;
  const path = opts.req.path || opts.req.url || 'unknown';
  const userAgent = (opts.req.headers['user-agent'] || '').substring(0, 80);

  try {
    user = await sdk.authenticateRequest(opts.req);
    
    // Log successful auth
    AUTH_LOG.push({
      timestamp: new Date().toISOString(),
      hasCookie,
      cookieLength,
      success: true,
      userId: user?.id?.substring(0, 10) || null,
      error: null,
      path,
      userAgent,
    });
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    
    // Log failed auth
    AUTH_LOG.push({
      timestamp: new Date().toISOString(),
      hasCookie,
      cookieLength,
      success: false,
      userId: null,
      error: errorMsg,
      path,
      userAgent,
    });

    if (hasCookie) {
      console.error('[Auth Context] Auth failed despite having session cookie:', errorMsg);
    }
    user = null;
  }

  // Keep only last N entries
  while (AUTH_LOG.length > MAX_LOG_ENTRIES) {
    AUTH_LOG.shift();
  }

  // Ler empresa/filial ativa do header ou cookie
  let activeCompanyId: number | undefined = undefined;
  let activeBranchId: number | undefined = undefined;

  const companyHeader = opts.req.headers["x-company-id"];
  const branchHeader = opts.req.headers["x-branch-id"];

  if (companyHeader) {
    activeCompanyId = parseInt(String(companyHeader), 10) || undefined;
  }
  if (branchHeader) {
    activeBranchId = parseInt(String(branchHeader), 10) || undefined;
  }

  // Fallback: se não veio no header, tentar do cookie
  if (!activeCompanyId && opts.req.cookies?.activeCompanyId) {
    activeCompanyId = parseInt(opts.req.cookies.activeCompanyId, 10) || undefined;
  }
  if (!activeBranchId && opts.req.cookies?.activeBranchId) {
    activeBranchId = parseInt(opts.req.cookies.activeBranchId, 10) || undefined;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    activeCompanyId,
    activeBranchId,
  };
}
