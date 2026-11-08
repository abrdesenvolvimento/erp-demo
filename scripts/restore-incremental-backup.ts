import mysql from "mysql2/promise";
import {
  executeIncrementalRestore,
  MAX_ARTIFACT_BYTES,
  parseRestoreArguments,
  sanitizedRestoreError,
  validateRestoreTarget,
} from "../server/restoreExecution";
import type { CompletedBackupRun } from "../server/restoreWorkflow";

/** Source connection is SELECT-only in this CLI; never used as a restore target. */
async function loadRun(runId: string): Promise<CompletedBackupRun> {
  if (!process.env.DATABASE_URL) throw new Error("SOURCE_URL_MISSING");
  const url = new URL(process.env.DATABASE_URL);
  if (url.protocol !== "mysql:") throw new Error("SOURCE_URL_INVALID");
  const source = await mysql.createConnection({
    host: url.hostname.replace(/^\[|\]$/g, ""), port: Number(url.port || 3306),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)), ssl: { rejectUnauthorized: true },
    multipleStatements: false, dateStrings: true, timezone: "Z", connectTimeout: 20_000,
  });
  try {
    const [rows] = await source.execute<mysql.RowDataPacket[]>(
      "SELECT id, status, phase, activeSlot, manifestJson, databaseChecksum, codeChecksum, codeKey, chunksCreated, rowsExported, lastError FROM backupRuns WHERE id = ? LIMIT 1",
      [runId],
    );
    if (!rows[0]) throw new Error("BACKUP_RUN_NOT_FOUND");
    return rows[0] as CompletedBackupRun;
  } finally { await source.end(); }
}

async function downloadBuffer(key: string): Promise<Buffer> {
  // Lazy import keeps argument/target guards ahead of any storage interaction.
  const { storageGet } = await import("../server/storage");
  const { url } = await storageGet(key, 900);
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) throw Object.assign(new Error("ARTIFACT_HTTP_FAILURE"), { code: `HTTP_${response.status}` });
  const length = response.headers.get("content-length");
  if (length && Number(length) > MAX_ARTIFACT_BYTES) {
    await response.body.cancel(); throw Object.assign(new Error("ARTIFACT_TOO_LARGE"), { code: "ARTIFACT_TOO_LARGE" });
  }
  const reader = response.body.getReader();
  const pieces: Buffer[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_ARTIFACT_BYTES) throw Object.assign(new Error("ARTIFACT_TOO_LARGE"), { code: "ARTIFACT_TOO_LARGE" });
      pieces.push(Buffer.from(part.value));
    }
    return Buffer.concat(pieces, bytes);
  } finally { await reader.cancel().catch(() => undefined); }
}

async function main() {
  process.umask(0o077);
  const options = parseRestoreArguments(process.argv.slice(2));
  // No fallback to DATABASE_URL and no alternate environment-variable aliases.
  if (options.apply || process.env.RESTORE_DATABASE_URL) {
    validateRestoreTarget(process.env.RESTORE_DATABASE_URL, process.env.DATABASE_URL);
  }
  const audit = await executeIncrementalRestore(options, {
    loadRun, download: downloadBuffer,
    connect: config => mysql.createConnection(config),
    restoreUrl: process.env.RESTORE_DATABASE_URL,
    productionUrl: process.env.DATABASE_URL,
    progress: message => console.log(message),
  });
  if (audit.status === "FAILED") {
    console.error(audit.error);
    process.exitCode = 1;
  }
}

main().then(() => process.exit(process.exitCode || 0)).catch(error => {
  console.error(sanitizedRestoreError(error));
  process.exit(1);
});
