import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { notifyOwner } from "./_core/notification";

export const BACKUP_STALE_HOURS = 36;
export type BackupHealth = { level: "OK" | "WARNING"; reason: "RECENT_COMPLETE" | "NO_COMPLETE" | "STALE_COMPLETE"; ageHours: number | null };

export function assessBackupHealth(latestCompletedAt: Date | string | null, now = new Date()): BackupHealth {
  if (!latestCompletedAt) return { level: "WARNING", reason: "NO_COMPLETE", ageHours: null };
  const value = latestCompletedAt instanceof Date ? latestCompletedAt.getTime() : Date.parse(latestCompletedAt.endsWith("Z") ? latestCompletedAt : latestCompletedAt.replace(" ", "T") + "Z");
  if (!Number.isFinite(value) || value > now.getTime()) return { level: "WARNING", reason: "NO_COMPLETE", ageHours: null };
  const ageHours = (now.getTime() - value) / 3_600_000;
  return { level: ageHours >= BACKUP_STALE_HOURS ? "WARNING" : "OK", reason: ageHours >= BACKUP_STALE_HOURS ? "STALE_COMPLETE" : "RECENT_COMPLETE", ageHours };
}

/** Metadata-only alert. No dump, restore, pruning, or writes to business tables. */
export async function checkAndNotifyBackupHealth() {
  const db = await getDb();
  if (!db) return { notification: "UNAVAILABLE" as const };
  const [result] = await db.execute(sql`SELECT updatedAt FROM backupRuns WHERE status='COMPLETE' AND phase='COMPLETE' AND activeSlot IS NULL AND lastError IS NULL ORDER BY updatedAt DESC LIMIT 1`) as any;
  const health = assessBackupHealth(result[0]?.updatedAt ?? null);
  if (health.level === "OK") return { ...health, notification: "NOT_NEEDED" as const };
  // A unique UTC day/reason key bounds notification volume across Cloud Run instances.
  const key = createHash("sha256").update(`backup-health:${new Date().toISOString().slice(0, 10)}`).digest("hex");
  const reason = health.reason;
  const [inserted] = await db.execute(sql`INSERT IGNORE INTO backupHealthAlerts (id,reason,status,createdAt) VALUES (${key},${reason},'PENDING',UTC_TIMESTAMP(3))`) as any;
  if (!inserted.affectedRows) return { ...health, notification: "ALREADY_RECORDED" as const };
  let sent = false;
  try {
    sent = await notifyOwner({
      title: "ABRWF — atenção ao backup",
      content: health.reason === "NO_COMPLETE"
        ? "Não há ciclo completo elegível registrado. Verifique a rotina do backup. Uma exportação parcial não deve ser usada para recuperação."
        : `O último ciclo completo elegível foi concluído há ${Math.floor(health.ageHours!)} horas. O limite de acompanhamento é ${BACKUP_STALE_HOURS} horas. Verifique a rotina; COMPLETE não substitui validação de arquivos e restauração.`,
    });
  } catch {
    sent = false;
  } finally {
    await db.execute(sql`UPDATE backupHealthAlerts SET status=${sent ? "SENT" : "FAILED"},finishedAt=UTC_TIMESTAMP(3) WHERE id=${key} AND status='PENDING'`);
  }
  return { ...health, notification: sent ? "SENT" as const : "FAILED" as const };
}
