import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  activeCompanyId: number | null;
  activeBranchId: number | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Ler empresa/filial ativa do header ou cookie
  let activeCompanyId: number | null = null;
  let activeBranchId: number | null = null;

  const companyHeader = opts.req.headers["x-company-id"];
  const branchHeader = opts.req.headers["x-branch-id"];

  if (companyHeader) {
    activeCompanyId = parseInt(String(companyHeader), 10) || null;
  }
  if (branchHeader) {
    activeBranchId = parseInt(String(branchHeader), 10) || null;
  }

  // Fallback: se não veio no header, tentar do cookie
  if (!activeCompanyId && opts.req.cookies?.activeCompanyId) {
    activeCompanyId = parseInt(opts.req.cookies.activeCompanyId, 10) || null;
  }
  if (!activeBranchId && opts.req.cookies?.activeBranchId) {
    activeBranchId = parseInt(opts.req.cookies.activeBranchId, 10) || null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    activeCompanyId,
    activeBranchId,
  };
}
