import { randomUUID } from "crypto";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { backupRuns, type BackupRun, type InsertBackupRun } from "../drizzle/schema";
import { getDb } from "./db";

export const BACKUP_PROGRESS_PROTOCOL = 2;
export const BACKUP_PROTOCOL_VERSION = BACKUP_PROGRESS_PROTOCOL;
export const BACKUP_BATCH_BUDGET_MS = 45_000;
export const BACKUP_LEASE_SECONDS = 75;
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type BackupLease = { owner: string; version: number; run: BackupRun };
export class BackupLeaseLostError extends Error {
  constructor() { super("Lease expirado ou substituído; callback sem autorização para continuar."); }
}
export class BackupDeadlineError extends Error {
  constructor() { super("Orçamento do callback esgotado; progresso confirmado preservado."); }
}
export function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number })?.affectedRows ?? 0);
}
export async function readBackupRun(db: Db, id: string) {
  const [run] = await db.select().from(backupRuns).where(eq(backupRuns.id, id)).limit(1);
  return run;
}
export async function claimBackupLease(db: Db, run: BackupRun): Promise<BackupLease | null> {
  const owner = randomUUID();
  // Relógio do banco: CAS de versão evita adquirir um snapshot desatualizado.
  const claimed = await db.update(backupRuns).set({
    leaseOwner: owner,
    leaseExpiresAt: sql`DATE_ADD(NOW(), INTERVAL ${sql.raw(String(BACKUP_LEASE_SECONDS))} SECOND)`,
    leaseVersion: sql`${backupRuns.leaseVersion} + 1`,
    updatedAt: sql`${backupRuns.updatedAt}`,
  }).where(and(
    eq(backupRuns.id, run.id), eq(backupRuns.status, "ACTIVE"),
    eq(backupRuns.leaseVersion, run.leaseVersion),
    or(isNull(backupRuns.leaseOwner), isNull(backupRuns.leaseExpiresAt), lte(backupRuns.leaseExpiresAt, sql`NOW()`)),
  ));
  if (affectedRows(claimed) !== 1) return null;
  const fresh = await readBackupRun(db, run.id);
  if (!fresh || fresh.leaseOwner !== owner || fresh.leaseVersion !== run.leaseVersion + 1) return null;
  return { owner, version: fresh.leaseVersion, run: fresh };
}
export function ownedFence(lease: BackupLease) {
  return and(eq(backupRuns.id, lease.run.id), eq(backupRuns.status, "ACTIVE"),
    eq(backupRuns.leaseOwner, lease.owner), eq(backupRuns.leaseVersion, lease.version),
    sql`${backupRuns.leaseExpiresAt} > NOW()`);
}
export async function requireOwned(db: Db, lease: BackupLease) {
  const [owned] = await db.select().from(backupRuns).where(ownedFence(lease)).limit(1);
  if (!owned) throw new BackupLeaseLostError();
}
export async function commitOwned(
  db: Db, lease: BackupLease, values: Partial<InsertBackupRun>,
  logUpdate?: (tx: Db) => Promise<void>,
): Promise<boolean> {
  return db.transaction(async tx => {
    // A atualização bloqueia a linha até COMMIT; o log terminal é da mesma
    // transação, nunca uma escrita tardia de um callback que perdeu a posse.
    const changed = await tx.update(backupRuns).set(values).where(ownedFence(lease));
    if (affectedRows(changed) !== 1) return false;
    if (logUpdate) await logUpdate(tx as unknown as Db);
    return true;
  });
}
export async function releaseBackupLease(db: Db, lease: BackupLease) {
  await db.update(backupRuns).set({ leaseOwner: null, leaseExpiresAt: null, updatedAt: sql`${backupRuns.updatedAt}` }).where(ownedFence(lease));
}
/** Limita a espera. I/O sem cancelamento pode terminar, mas jamais confirma estado. */
export async function beforeDeadline<T>(operation: () => Promise<T>, deadline: number): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new BackupDeadlineError();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new BackupDeadlineError()), remaining); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
