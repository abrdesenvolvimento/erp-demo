import { createHash, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { and, asc, eq, lt } from "drizzle-orm";
import { backupLogs, backupRuns } from "../drizzle/schema";
import { createBackupLog, getDb, updateBackupLogFailed, updateBackupLogSuccess } from "./db";
import { storagePut } from "./storage";

// Mantém cada artefato pequeno o suficiente para o callback, mas permite concluir
// o ciclo diário em uma janela de algumas horas quando acionado a cada cinco minutos.
const CHUNK_ROWS = 10_000;
const STALE_RUN_MINUTES = 26 * 60;
const MIN_NEW_BACKUP_INTERVAL_MS = 20 * 60 * 60 * 1000;
const RUN_PREFIX = "backups/incremental";

type ManifestChunk = {
  key: string;
  table: string;
  offset: number;
  rows: number;
  checksum: string;
  bytes: number;
};

type BackupManifest = {
  version: 1;
  runId: string;
  startedAt: string;
  snapshotNote: string;
  chunks: ManifestChunk[];
  code?: { key: string; checksum: string; bytes: number };
};

function hash(data: Buffer | string) {
  return createHash("sha256").update(data).digest("hex");
}

function newManifest(runId: string): BackupManifest {
  return {
    version: 1,
    runId,
    startedAt: new Date().toISOString(),
    snapshotNote: "Backup lógico incremental. As tabelas são exportadas em sequência; valide o manifesto e os checksums antes de uma restauração.",
    chunks: [],
  };
}

function parseManifest(raw: string | null): BackupManifest {
  if (!raw) return newManifest("unknown");
  try {
    const parsed = JSON.parse(raw) as BackupManifest;
    if (parsed.version === 1 && Array.isArray(parsed.chunks)) return parsed;
  } catch {
    // A execução falhará com mensagem auditável no próximo avanço.
  }
  throw new Error("Manifesto de backup inválido; a execução precisa ser revisada antes de continuar.");
}

function databaseConfig() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL não configurado");
  const url = new URL(rawUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: true },
    connectTimeout: 20_000,
  };
}

function quoteIdentifier(identifier: string) {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

function escapeSqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace("T", " ")}'`;
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
  return `'${String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\0/g, "\\0")}'`;
}

async function listTables(connection: mysql.Connection): Promise<string[]> {
  const [rows] = await connection.query("SHOW TABLES") as any[];
  if (!rows.length) return [];
  const key = Object.keys(rows[0])[0];
  return rows.map((row: Record<string, string>) => row[key]).sort();
}

async function exportDatabaseChunk(run: typeof backupRuns.$inferSelect) {
  const connection = await mysql.createConnection(databaseConfig());
  try {
    const tables = await listTables(connection);
    if (run.currentTableIndex >= tables.length) {
      return { complete: true as const, tablesCount: tables.length };
    }

    const table = tables[run.currentTableIndex];
    const offset = run.currentTableOffset;
    const [rows] = await connection.query(
      `SELECT * FROM ${quoteIdentifier(table)} LIMIT ${CHUNK_ROWS} OFFSET ${offset}`
    ) as any[];

    let content = "";
    if (offset === 0) {
      const [createRows] = await connection.query(`SHOW CREATE TABLE ${quoteIdentifier(table)}`) as any[];
      const createSql = createRows[0]["Create Table"];
      content += `-- ABRWF ERP incremental database backup\n`;
      content += `-- Run: ${run.id}\n-- Table: ${table}\n-- Offset: ${offset}\n`;
      content += `DROP TABLE IF EXISTS ${quoteIdentifier(table)};\n${createSql};\n\n`;
    }

    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);
      const columnsSql = columns.map(quoteIdentifier).join(", ");
      for (let index = 0; index < rows.length; index += 100) {
        const batch = rows.slice(index, index + 100);
        const values = batch.map((row: Record<string, unknown>) =>
          `(${columns.map(column => escapeSqlValue(row[column])).join(", ")})`
        ).join(",\n");
        content += `INSERT INTO ${quoteIdentifier(table)} (${columnsSql}) VALUES\n${values};\n`;
      }
    }

    const isLastChunkOfTable = rows.length < CHUNK_ROWS;
    const nextTableIndex = isLastChunkOfTable ? run.currentTableIndex + 1 : run.currentTableIndex;
    const nextTableOffset = isLastChunkOfTable ? 0 : offset + rows.length;
    return {
      complete: false as const,
      table,
      offset,
      rows: rows.length,
      content: Buffer.from(content, "utf8"),
      nextTableIndex,
      nextTableOffset,
      tablesCount: tables.length,
    };
  } finally {
    await connection.end();
  }
}

async function createCodeArchive(runId: string): Promise<Buffer> {
  const archiver = (await import("archiver")).default;
  const archivePath = path.join("/tmp", `abrwf-code-${runId}.zip`);
  const exclusions = ["node_modules", ".git", "backups", "dist", "coverage", ".next"];
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(archivePath);
    const archive = archiver("zip", { zlib: { level: 6 } });
    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.glob("**/*", { cwd: process.cwd(), ignore: exclusions.map(item => `${item}/**`), dot: true });
    archive.finalize();
  });
  try {
    return fs.readFileSync(archivePath);
  } finally {
    fs.rmSync(archivePath, { force: true });
  }
}

async function persistManifest(runId: string, manifest: BackupManifest) {
  const encoded = JSON.stringify(manifest, null, 2);
  const checksum = hash(encoded);
  const stored = await storagePut(`${RUN_PREFIX}/${runId}/manifest.json`, encoded, "application/json");
  return { encoded, checksum, stored };
}

export async function reconcileStaleBackupRuns() {
  const db = await getDb();
  if (!db) return 0;
  const cutoff = new Date(Date.now() - STALE_RUN_MINUTES * 60_000);

  // Corrige os logs legados que ficaram em running quando o callback antigo expirou.
  const staleLegacyLogs = await db.select().from(backupLogs)
    .where(and(eq(backupLogs.status, "running"), lt(backupLogs.startedAt, cutoff)));
  if (staleLegacyLogs.length > 0) {
    await db.update(backupLogs).set({
      completedAt: new Date(),
      status: "failed",
      errorMessage: "Execução interrompida antes da conclusão; reconciliada pelo fluxo incremental.",
      durationSeconds: "0.00",
    }).where(and(eq(backupLogs.status, "running"), lt(backupLogs.startedAt, cutoff)));
  }

  const staleRuns = await db.select().from(backupRuns)
    .where(and(eq(backupRuns.status, "ACTIVE"), lt(backupRuns.updatedAt, cutoff)));

  for (const run of staleRuns) {
    await db.update(backupRuns).set({
      status: "FAILED",
      lastError: `Execução interrompida sem progresso por mais de ${STALE_RUN_MINUTES} minutos.`,
      updatedAt: new Date(),
    }).where(eq(backupRuns.id, run.id));
    await updateBackupLogFailed(run.backupLogId, "Execução incremental interrompida por inatividade.", 0);
  }
  return staleLegacyLogs.length + staleRuns.length;
}

async function startRun(triggeredBy: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível para iniciar backup");
  const active = await db.select().from(backupRuns)
    .where(eq(backupRuns.status, "ACTIVE"))
    .orderBy(asc(backupRuns.createdAt))
    .limit(1);
  if (active[0]) return active[0];

  const latestCompleted = await db.select().from(backupRuns)
    .where(eq(backupRuns.status, "COMPLETE"))
    .orderBy(asc(backupRuns.updatedAt))
    .limit(1);
  if (latestCompleted[0]?.updatedAt) {
    const elapsed = Date.now() - new Date(latestCompleted[0].updatedAt).getTime();
    if (elapsed < MIN_NEW_BACKUP_INTERVAL_MS) return null;
  }

  const backupLogId = await createBackupLog(triggeredBy);
  const id = `backup-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const manifest = newManifest(id);
  await db.insert(backupRuns).values({
    id,
    backupLogId,
    status: "ACTIVE",
    phase: "DATABASE",
    manifestJson: JSON.stringify(manifest),
  });
  const created = await db.select().from(backupRuns).where(eq(backupRuns.id, id)).limit(1);
  return created[0];
}

/** Avança uma única etapa curta do backup. Pode ser chamado repetidamente pelo Heartbeat. */
export async function advanceBackupRun(triggeredBy: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível para avançar backup");
  const run = await startRun(triggeredBy);
  if (!run) {
    return { runId: null, status: "SKIPPED" as const, phase: "COMPLETE" as const, table: null, rows: 0, chunksCreated: 0 };
  }
  const manifest = parseManifest(run.manifestJson);
  manifest.runId = run.id;

  try {
    if (run.phase === "DATABASE") {
      const step = await exportDatabaseChunk(run);
      if (!step.complete) {
        const sequence = String(run.chunksCreated + 1).padStart(6, "0");
        const key = `${RUN_PREFIX}/${run.id}/database/${sequence}-${step.table}-${step.offset}.sql`;
        const checksum = hash(step.content);
        await storagePut(key, step.content, "application/sql");
        manifest.chunks.push({ key, table: step.table, offset: step.offset, rows: step.rows, checksum, bytes: step.content.length });
        const persisted = await persistManifest(run.id, manifest);
        await db.update(backupRuns).set({
          currentTableIndex: step.nextTableIndex,
          currentTableOffset: step.nextTableOffset,
          chunksCreated: run.chunksCreated + 1,
          rowsExported: run.rowsExported + step.rows,
          manifestJson: persisted.encoded,
          databaseChecksum: persisted.checksum,
          updatedAt: new Date(),
        }).where(eq(backupRuns.id, run.id));
        return { runId: run.id, status: "ACTIVE" as const, phase: "DATABASE" as const, table: step.table, rows: step.rows, chunksCreated: run.chunksCreated + 1 };
      }
      await db.update(backupRuns).set({ phase: "CODE", updatedAt: new Date() }).where(eq(backupRuns.id, run.id));
      return { runId: run.id, status: "ACTIVE" as const, phase: "CODE" as const, table: null, rows: 0, chunksCreated: run.chunksCreated };
    }

    if (run.phase === "CODE") {
      const archive = await createCodeArchive(run.id);
      const checksum = hash(archive);
      const key = `${RUN_PREFIX}/${run.id}/code/abrwf-source.zip`;
      const stored = await storagePut(key, archive, "application/zip");
      manifest.code = { key: stored.key, checksum, bytes: archive.length };
      const persisted = await persistManifest(run.id, manifest);
      await db.update(backupRuns).set({
        status: "COMPLETE",
        phase: "COMPLETE",
        manifestJson: persisted.encoded,
        databaseChecksum: persisted.checksum,
        codeChecksum: checksum,
        codeKey: stored.key,
        codeUrl: stored.url,
        updatedAt: new Date(),
      }).where(eq(backupRuns.id, run.id));
      await updateBackupLogSuccess(run.backupLogId, {
        databaseFile: "manifest.json",
        databaseSize: Buffer.byteLength(persisted.encoded),
        codeFile: "abrwf-source.zip",
        codeSize: archive.length,
        databaseDriveId: `${RUN_PREFIX}/${run.id}/manifest.json`,
        databaseDriveLink: persisted.stored.url,
        codeDriveId: stored.key,
        codeDriveLink: stored.url,
        localFilesDeleted: 0,
        driveFilesDeleted: 0,
        durationSeconds: (Date.now() - new Date(run.createdAt ?? new Date()).getTime()) / 1000,
      });
      return { runId: run.id, status: "COMPLETE" as const, phase: "COMPLETE" as const, table: null, rows: run.rowsExported, chunksCreated: run.chunksCreated };
    }

    return { runId: run.id, status: run.status, phase: run.phase, table: null, rows: run.rowsExported, chunksCreated: run.chunksCreated };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(backupRuns).set({ status: "FAILED", lastError: message, updatedAt: new Date() })
      .where(eq(backupRuns.id, run.id));
    await updateBackupLogFailed(run.backupLogId, message, (Date.now() - new Date(run.createdAt ?? new Date()).getTime()) / 1000);
    throw error;
  }
}
