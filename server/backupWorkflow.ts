import { createHash, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import { backupLogs, backupRuns, type BackupRun } from "../drizzle/schema";
import { createBackupLog, getDb, updateBackupLogFailed } from "./db";
import { storagePut } from "./storage";
import {
  BACKUP_PROGRESS_PROTOCOL, BACKUP_BATCH_BUDGET_MS, BackupDeadlineError, BackupLeaseLostError,
  beforeDeadline, claimBackupLease, commitOwned, readBackupRun, releaseBackupLease, requireOwned,
  type BackupLease,
} from "./backupProgress";

const CHUNK_ROWS = 10_000;
const STALE_RUN_MINUTES = 26 * 60;
const MIN_NEW_BACKUP_INTERVAL_MS = 20 * 60 * 60 * 1000;
const RUN_PREFIX = "backups/incremental";
export const MAX_HEARTBEAT_BACKUP_STEPS = 8;
export { BACKUP_PROTOCOL_VERSION } from "./backupProgress";
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type ManifestChunk = { key: string; table: string; offset: number; rows: number; checksum: string; bytes: number };
type BackupManifest = {
  version: 1; runId: string; startedAt: string; snapshotNote: string;
  chunks: ManifestChunk[]; code?: { key: string; checksum: string; bytes: number };
};
type Plan = { version: 2; tables: { name: string; createSql: string; ddlHash: string; primaryKey: string[] }[] };

function hash(data: Buffer | string) { return createHash("sha256").update(data).digest("hex"); }
function newManifest(runId: string): BackupManifest {
  return {
    version: 1, runId, startedAt: new Date().toISOString(),
    snapshotNote: "Protocolo 2: inventário e DDL congelados. ORDER BY chave primária com OFFSET por compatibilidade com os offsets do manifesto v1; não é snapshot global consistente. Inserções, exclusões e alterações de PK durante o ciclo podem deslocar páginas; validar dados antes de restaurar. Sem PK: falha controlada, nunca paginação não ordenada.",
    chunks: [],
  };
}
function parseManifest(raw: string | null): BackupManifest {
  try {
    const parsed = JSON.parse(raw ?? "") as BackupManifest;
    if (parsed.version === 1 && Array.isArray(parsed.chunks)) return parsed;
  } catch { /* falha auditável dentro do fence */ }
  throw new Error("Manifesto de backup inválido; revisar antes de continuar.");
}
function parsePlan(raw: string): Plan {
  const plan = JSON.parse(raw) as Plan;
  if (plan.version !== 2 || !Array.isArray(plan.tables) || plan.tables.some(t =>
    !/^[A-Za-z0-9_]+$/.test(t.name) || !t.createSql || !t.ddlHash || !Array.isArray(t.primaryKey))) {
    throw new Error("Plano de backup inválido; revisar antes de continuar.");
  }
  return plan;
}
function isDuplicateActiveRunError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | undefined;
  return candidate?.code === "ER_DUP_ENTRY" || Boolean(candidate?.message?.includes("backup_single_active_idx"));
}
function databaseConfig() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL não configurado");
  const url = new URL(rawUrl);
  return {
    host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password), database: url.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: true }, connectTimeout: 20_000,
  };
}
function quoteIdentifier(identifier: string) { return `\`${identifier.replace(/`/g, "``")}\``; }
function escapeSqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace("T", " ")}'`;
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\0/g, "\\0")}'`;
}
async function listTables(connection: mysql.Connection): Promise<string[]> {
  const [rows] = await connection.query("SHOW TABLES") as any[];
  if (!rows.length) return [];
  const key = Object.keys(rows[0])[0];
  const tables = rows.map((row: Record<string, string>) => row[key]).sort();
  if (tables.some((name: string) => !/^[A-Za-z0-9_]+$/.test(name))) throw new Error("Inventário contém identificador não suportado.");
  return tables;
}
async function createSqlFor(connection: mysql.Connection, name: string) {
  const [rows] = await connection.query(`SHOW CREATE TABLE ${quoteIdentifier(name)}`) as any[];
  const ddl = rows[0]?.["Create Table"];
  if (typeof ddl !== "string") throw new Error(`DDL indisponível para ${name}.`);
  // AUTO_INCREMENT atual varia com DML; não é mudança de estrutura.
  return ddl.replace(/ AUTO_INCREMENT=\d+/g, "");
}
async function withConnection<T>(deadline: number, operation: (connection: mysql.Connection) => Promise<T>): Promise<T> {
  let connection: mysql.Connection | undefined;
  let expired = false;
  try {
    return await beforeDeadline(async () => {
      connection = await mysql.createConnection(databaseConfig());
      if (expired || Date.now() >= deadline) { connection.destroy(); throw new BackupDeadlineError(); }
      return operation(connection);
    }, deadline);
  } finally {
    expired = true;
    // Destruir a conexão também interrompe consultas que ultrapassaram a janela.
    connection?.destroy();
  }
}
async function freezePlan(deadline: number): Promise<Plan> {
  return withConnection(deadline, async connection => {
    const tables: Plan["tables"] = [];
    for (const name of await listTables(connection)) {
      if (Date.now() >= deadline) throw new BackupDeadlineError();
      const createSql = await createSqlFor(connection, name);
      const pkDefinition = createSql.match(/PRIMARY KEY\s*\(([^\n]+?)\)/i)?.[1] ?? "";
      const primaryKey = [...pkDefinition.matchAll(/`((?:``|[^`])+)`/g)].map(m => m[1].replace(/``/g, "`"));
      tables.push({ name, createSql, ddlHash: hash(createSql), primaryKey });
    }
    return { version: 2, tables };
  });
}
async function checkInventory(connection: mysql.Connection, plan: Plan) {
  if (JSON.stringify(await listTables(connection)) !== JSON.stringify(plan.tables.map(t => t.name))) {
    throw new Error("Inventário de tabelas mudou após congelamento; ciclo interrompido antes de novo artefato. Iniciar ciclo novo.");
  }
}
async function checkDdl(connection: mysql.Connection, table: Plan["tables"][number]) {
  if (hash(await createSqlFor(connection, table.name)) !== table.ddlHash) {
    throw new Error(`Schema de ${table.name} mudou após congelamento; ciclo interrompido antes de novo artefato.`);
  }
}
async function exportDatabaseChunk(run: BackupRun, plan: Plan, deadline: number) {
  return withConnection(deadline, async connection => {
    await checkInventory(connection, plan);
    if (run.currentTableIndex >= plan.tables.length) return { complete: true as const };
    const planned = plan.tables[run.currentTableIndex];
    await checkDdl(connection, planned);
    if (!planned.primaryKey.length) throw new Error(`Tabela ${planned.name} sem PK; paginação estável não suportada. Ciclo interrompido.`);
    const table = planned.name;
    const offset = run.currentTableOffset;
    const orderBy = planned.primaryKey.map(quoteIdentifier).join(", ");
    const [rows] = await connection.query(
      `SELECT * FROM ${quoteIdentifier(table)} ORDER BY ${orderBy} LIMIT ${CHUNK_ROWS} OFFSET ${offset}`
    ) as any[];
    let content = "";
    if (offset === 0) {
      content += `-- ABRWF ERP incremental database backup\n-- Run: ${run.id}\n-- Table: ${table}\n-- Offset: ${offset}\n`;
      content += `DROP TABLE IF EXISTS ${quoteIdentifier(table)};\n${planned.createSql};\n\n`;
    }
    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);
      const columnsSql = columns.map(quoteIdentifier).join(", ");
      for (let index = 0; index < rows.length; index += 100) {
        const values = rows.slice(index, index + 100).map((row: Record<string, unknown>) =>
          `(${columns.map(column => escapeSqlValue(row[column])).join(", ")})`).join(",\n");
        content += `INSERT INTO ${quoteIdentifier(table)} (${columnsSql}) VALUES\n${values};\n`;
      }
    }
    // Uma página terminal vazia não cria SQL vazio incompatível com restore v1.
    if (offset > 0 && rows.length === 0) return { complete: false as const, empty: true as const, table, offset,
      rows: 0, content: Buffer.alloc(0), nextTableIndex: run.currentTableIndex + 1, nextTableOffset: 0 };
    const last = rows.length < CHUNK_ROWS;
    return { complete: false as const, empty: false as const, table, offset, rows: rows.length,
      content: Buffer.from(content, "utf8"), nextTableIndex: last ? run.currentTableIndex + 1 : run.currentTableIndex,
      nextTableOffset: last ? 0 : offset + rows.length };
  });
}
export const CODE_ARCHIVE_EXCLUSIONS = [
  "node_modules/**", ".git/**", "backups/**", "dist/**", "coverage/**", ".next/**",
  ".env", ".env.*", "**/.env", "**/.env.*", "*.env", "**/*.env", ".project-config.json", ".project-config*", "**/.project-config*",
  ".manus/**", "**/.manus/**", "**/*.pem", "**/*.key", "**/*credential*", "**/*github*credential*",
  ".npmrc", "**/.npmrc", ".netrc", "**/.netrc", "**/.git-credentials", "**/.ssh/**",
  "**/.git/**",
];
async function createCodeArchive(runId: string, owner: string, deadline: number): Promise<Buffer> {
  const archiver = (await import("archiver")).default;
  const archivePath = path.join("/tmp", `abrwf-code-${runId}-${owner}.zip`);
  const archive = archiver("zip", { zlib: { level: 6 } });
  const output = fs.createWriteStream(archivePath);
  try {
    await beforeDeadline(() => new Promise<void>((resolve, reject) => {
      output.on("close", resolve); output.on("error", reject); archive.on("error", reject);
      archive.pipe(output);
      // Globs já completos: acrescentar /** a .env transformava exclusão de arquivo em diretório.
      archive.glob("**/*", { cwd: process.cwd(), ignore: CODE_ARCHIVE_EXCLUSIONS, dot: true });
      void archive.finalize().catch(reject);
    }), deadline);
    return fs.readFileSync(archivePath);
  } finally {
    archive.abort(); output.destroy(); fs.rmSync(archivePath, { force: true });
  }
}
async function persistManifest(runId: string, owner: string, manifest: BackupManifest, deadline: number) {
  const encoded = JSON.stringify(manifest, null, 2);
  const checksum = hash(encoded);
  const key = `${RUN_PREFIX}/${runId}/manifests/rev-${owner}-${randomUUID()}.json`;
  const stored = await beforeDeadline(() => storagePut(key, encoded, "application/json"), deadline);
  return { encoded, checksum, stored };
}
async function terminalFailure(db: Db, lease: BackupLease, message: string) {
  return commitOwned(db, lease, { status: "FAILED", activeSlot: null, lastError: message,
    leaseOwner: null, leaseExpiresAt: null, updatedAt: new Date() }, async tx => {
    await tx.update(backupLogs).set({ status: "failed", completedAt: new Date(), errorMessage: message,
      durationSeconds: ((Date.now() - new Date(lease.run.createdAt ?? new Date()).getTime()) / 1000).toFixed(2),
    }).where(eq(backupLogs.id, lease.run.backupLogId));
  });
}
export async function reconcileStaleBackupRuns() {
  const db = await getDb();
  if (!db) return 0;
  const cutoff = new Date(Date.now() - STALE_RUN_MINUTES * 60_000);
  let reconciled = 0;
  const staleRuns = await db.select().from(backupRuns)
    .where(and(eq(backupRuns.status, "ACTIVE"), lt(backupRuns.updatedAt, cutoff)));
  for (const run of staleRuns) {
    const lease = await claimBackupLease(db, run);
    if (!lease) continue;
    try {
      if (lease.run.updatedAt && lease.run.updatedAt < cutoff && await terminalFailure(db, lease,
        `Execução interrompida sem progresso por mais de ${STALE_RUN_MINUTES} minutos.`)) reconciled++;
    } finally { await releaseBackupLease(db, lease); }
  }
  // Não falhar um log pela idade do ciclo: qualquer ACTIVE ligado o protege,
  // e a inatividade do ACTIVE é decidida acima por updatedAt e lease.
  const orphanFence = and(eq(backupLogs.status, "running"), lt(backupLogs.startedAt, cutoff),
    sql`NOT EXISTS (SELECT 1 FROM ${backupRuns} WHERE ${backupRuns.backupLogId} = ${backupLogs.id})`);
  const orphanLogs = await db.select().from(backupLogs).where(orphanFence);
  for (const log of orphanLogs) {
    const result = await db.update(backupLogs).set({ completedAt: new Date(), status: "failed",
      errorMessage: "Execução interrompida antes da conclusão; reconciliada pelo fluxo incremental.",
      durationSeconds: "0.00" }).where(and(eq(backupLogs.id, log.id), orphanFence));
    const header = Array.isArray(result) ? result[0] : result;
    reconciled += Number((header as { affectedRows?: number }).affectedRows ?? 0);
  }
  return reconciled;
}
async function startRun(triggeredBy: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível para iniciar backup");
  const active = await db.select().from(backupRuns).where(eq(backupRuns.status, "ACTIVE"))
    .orderBy(asc(backupRuns.createdAt)).limit(1);
  if (active[0]) return active[0];
  const latestCompleted = await db.select().from(backupRuns).where(eq(backupRuns.status, "COMPLETE"))
    .orderBy(desc(backupRuns.updatedAt)).limit(1);
  if (latestCompleted[0]?.updatedAt) {
    const elapsed = Date.now() - new Date(latestCompleted[0].updatedAt).getTime();
    if (elapsed < MIN_NEW_BACKUP_INTERVAL_MS) return null;
  }
  const backupLogId = await createBackupLog(triggeredBy);
  const id = `backup-${Date.now()}-${randomUUID().slice(0, 8)}`;
  try {
    await db.insert(backupRuns).values({ id, backupLogId, activeSlot: 1, status: "ACTIVE", phase: "DATABASE",
      progressProtocol: BACKUP_PROGRESS_PROTOCOL, manifestJson: JSON.stringify(newManifest(id)) });
  } catch (error) {
    if (!isDuplicateActiveRunError(error)) throw error;
    // Este é só o log órfão criado por este callback, nunca o log do vencedor.
    await updateBackupLogFailed(backupLogId, "Outro callback já iniciou o ciclo incremental; execução reutilizada.", 0);
    const [existing] = await db.select().from(backupRuns).where(eq(backupRuns.status, "ACTIVE"))
      .orderBy(asc(backupRuns.createdAt)).limit(1);
    if (existing) return existing;
    throw error;
  }
  return readBackupRun(db, id);
}
function response(run: BackupRun | undefined, stepsProcessed: number, leaseSkipped: boolean, timedOut = false) {
  return { protocolVersion: BACKUP_PROGRESS_PROTOCOL, version: BACKUP_PROGRESS_PROTOCOL,
    runId: run?.id ?? null, status: run?.status ?? "SKIPPED", remainingStatus: run?.status ?? "SKIPPED",
    phase: run?.phase ?? "COMPLETE", table: null as string | null, rows: run?.rowsExported ?? 0,
    chunksCreated: run?.chunksCreated ?? 0, stepsProcessed, leaseSkipped, timedOut };
}
async function processOwnedStep(db: Db, lease: BackupLease, deadline: number) {
  const run = lease.run;
  if (run.progressProtocol !== BACKUP_PROGRESS_PROTOCOL) {
    throw new Error("Ciclo legado protocolo 1 sem inventário/ordenação congelados: continuidade não verificável após mudança de schema. Interrompido antes de novo artefato; iniciar ciclo novo protocolo 2. Não reordenar nem reaproveitar chunks legados.");
  }
  const manifest = parseManifest(run.manifestJson);
  if (manifest.runId !== run.id || manifest.chunks.length !== run.chunksCreated) throw new Error("Manifesto e contadores inconsistentes.");
  if (!run.planJson) {
    if (run.chunksCreated || run.currentTableIndex || run.currentTableOffset || run.phase !== "DATABASE") {
      throw new Error("Plano ausente em execução parcial; interrompida antes de novo artefato.");
    }
    const frozen = await freezePlan(deadline);
    if (Date.now() >= deadline) throw new BackupDeadlineError();
    if (!await commitOwned(db, lease, { planJson: JSON.stringify(frozen), updatedAt: new Date() })) return false;
    const fresh = await readBackupRun(db, run.id);
    if (!fresh) return false;
    lease.run = fresh;
  }
  const current = lease.run;
  const plan = parsePlan(current.planJson!);
  if (current.phase === "DATABASE") {
    const step = await exportDatabaseChunk(current, plan, deadline);
    if (Date.now() >= deadline) throw new BackupDeadlineError();
    if (step.complete) return commitOwned(db, lease, { phase: "CODE", updatedAt: new Date() });
    if (step.empty) return commitOwned(db, lease, {
      currentTableIndex: step.nextTableIndex, currentTableOffset: 0, updatedAt: new Date(),
    });
    const sequence = String(current.chunksCreated + 1).padStart(6, "0");
    const key = `${RUN_PREFIX}/${current.id}/database/${sequence}-${lease.owner}-${step.table}-${step.offset}.sql`;
    await requireOwned(db, lease);
    await beforeDeadline(() => storagePut(key, step.content, "application/sql"), deadline);
    manifest.chunks.push({ key, table: step.table, offset: step.offset, rows: step.rows,
      checksum: hash(step.content), bytes: step.content.length });
    await requireOwned(db, lease);
    const persisted = await persistManifest(current.id, lease.owner, manifest, deadline);
    if (Date.now() >= deadline) throw new BackupDeadlineError();
    return commitOwned(db, lease, { currentTableIndex: step.nextTableIndex, currentTableOffset: step.nextTableOffset,
      chunksCreated: current.chunksCreated + 1, rowsExported: current.rowsExported + step.rows,
      manifestJson: persisted.encoded, manifestKey: persisted.stored.key,
      databaseChecksum: persisted.checksum, updatedAt: new Date() });
  }
  if (current.phase !== "CODE") throw new Error("Fase ACTIVE inválida.");
  // Validação final única: evita repetir 70 SHOW CREATE em cada passo/lote.
  await withConnection(deadline, async connection => {
    await checkInventory(connection, plan);
    for (const table of plan.tables) { if (Date.now() >= deadline) throw new BackupDeadlineError(); await checkDdl(connection, table); }
  });
  const archive = await createCodeArchive(current.id, lease.owner, deadline);
  const checksum = hash(archive);
  const key = `${RUN_PREFIX}/${current.id}/code/${lease.owner}/abrwf-source.zip`;
  await requireOwned(db, lease);
  const stored = await beforeDeadline(() => storagePut(key, archive, "application/zip"), deadline);
  manifest.code = { key: stored.key, checksum, bytes: archive.length };
  await requireOwned(db, lease);
  const persisted = await persistManifest(current.id, lease.owner, manifest, deadline);
  if (Date.now() >= deadline) throw new BackupDeadlineError();
  return commitOwned(db, lease, { status: "COMPLETE", phase: "COMPLETE", activeSlot: null,
    leaseOwner: null, leaseExpiresAt: null, lastError: null, manifestJson: persisted.encoded,
    manifestKey: persisted.stored.key, databaseChecksum: persisted.checksum, codeChecksum: checksum,
    codeKey: stored.key, codeUrl: stored.url, updatedAt: new Date() }, async tx => {
    // IDs legados de log têm 100 caracteres; as chaves versionadas longas são
    // autoritativas em backupRuns.manifestKey/codeKey, não truncadas no storage.
    await tx.update(backupLogs).set({ status: "success", completedAt: new Date(), errorMessage: null,
      databaseFile: path.posix.basename(persisted.stored.key), databaseSize: Buffer.byteLength(persisted.encoded),
      codeFile: "abrwf-source.zip", codeSize: archive.length,
      databaseDriveId: persisted.stored.key.length <= 100 ? persisted.stored.key : null,
      databaseDriveLink: persisted.stored.url, codeDriveId: stored.key.length <= 100 ? stored.key : null,
      codeDriveLink: stored.url, localFilesDeleted: 0, driveFilesDeleted: 0,
      durationSeconds: ((Date.now() - new Date(current.createdAt ?? new Date()).getTime()) / 1000).toFixed(2),
    }).where(eq(backupLogs.id, current.backupLogId));
  });
}
/** Uma posse por callback/lote; activeSlot impede ciclos, lease impede passos concorrentes.
 * NÃO protege contra backend v1 ainda publicado: ativar só após publicação controlada
 * e recibos protocolVersion=2. A migração sozinha NÃO autoriza iniciar o protocolo.
 */
export async function advanceBackupRunBatch(triggeredBy: string, maxSteps = MAX_HEARTBEAT_BACKUP_STEPS) {
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > MAX_HEARTBEAT_BACKUP_STEPS) {
    throw new Error(`Quantidade de etapas inválida; use entre 1 e ${MAX_HEARTBEAT_BACKUP_STEPS}.`);
  }
  const deadline = Date.now() + BACKUP_BATCH_BUDGET_MS;
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível para avançar backup");
  const run = await startRun(triggeredBy);
  if (!run) return response(undefined, 0, false);
  const lease = await claimBackupLease(db, run);
  if (!lease) return response(await readBackupRun(db, run.id), 0, true);
  let stepsProcessed = 0;
  try {
    while (stepsProcessed < maxSteps && lease.run.status === "ACTIVE" && Date.now() < deadline) {
      if (!await processOwnedStep(db, lease, deadline)) return response(await readBackupRun(db, run.id), stepsProcessed, true);
      stepsProcessed++;
      const fresh = await readBackupRun(db, run.id);
      if (!fresh) throw new Error("Execução desapareceu após progresso confirmado.");
      lease.run = fresh;
    }
    return response(await readBackupRun(db, run.id), stepsProcessed, false, Date.now() >= deadline);
  } catch (error) {
    if (error instanceof BackupDeadlineError) return response(await readBackupRun(db, run.id), stepsProcessed, false, true);
    if (error instanceof BackupLeaseLostError) return response(await readBackupRun(db, run.id), stepsProcessed, true);
    const message = error instanceof Error ? error.message : String(error);
    if (!await terminalFailure(db, lease, message)) return response(await readBackupRun(db, run.id), stepsProcessed, true);
    throw error;
  } finally { await releaseBackupLease(db, lease); }
}
export async function advanceBackupRun(triggeredBy: string) { return advanceBackupRunBatch(triggeredBy, 1); }
