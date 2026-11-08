import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { backupLogs, backupRuns, type BackupRun } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), createLog: vi.fn(), failLog: vi.fn(), put: vi.fn(), connect: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb, createBackupLog: mocks.createLog, updateBackupLogFailed: mocks.failLog }));
vi.mock("./storage", () => ({ storagePut: mocks.put }));
vi.mock("mysql2/promise", () => ({ default: { createConnection: mocks.connect } }));
vi.mock("archiver", async () => {
  const { PassThrough } = await import("stream");
  return { default: () => {
    const archive = new PassThrough() as any;
    archive.glob = vi.fn(); archive.abort = () => archive.destroy();
    archive.finalize = async () => { archive.end(Buffer.from("mockzip")); };
    return archive;
  } };
});
import { advanceBackupRunBatch, advanceBackupRun, reconcileStaleBackupRuns, CODE_ARCHIVE_EXCLUSIONS } from "./backupWorkflow";
import { beforeDeadline, BackupDeadlineError, claimBackupLease, releaseBackupLease } from "./backupProgress";

const ddl = "CREATE TABLE `items` (`id` int NOT NULL, PRIMARY KEY (`id`))";
const plan = JSON.stringify({ version: 2, tables: [{ name: "items", createSql: ddl,
  ddlHash: createHash("sha256").update(ddl).digest("hex"), primaryKey: ["id"] }] });
const dialect = new MySqlDialect();
let run: BackupRun;
let logs: Record<string, any>[];
let writes: { table: string; values: any; affected: number }[];
let inventory: string[];
let currentDdl: string;
let queryHook: ((query: string) => Promise<void>) | undefined;
let db: any;
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function matches(condition: any, row: any): boolean {
  const { sql, params } = dialect.sqlToQuery(condition);
  if (sql.includes("NOT EXISTS") && row.id === run.backupLogId) return false;
  let parameterIndex = 0;
  const comparisons = [...sql.matchAll(/`(?:backupRuns|backupLogs)`\.`(\w+)`\s*(=|<|<=)\s*\?/g)];
  for (const comparison of comparisons) {
    let value = params[parameterIndex++];
    const actual = row[comparison[1]];
    if (actual instanceof Date && typeof value === "string") value = new Date(value.replace(" ", "T") + "Z");
    if (comparison[2] === "=" && actual !== value) return false;
    if (comparison[2] === "<" && !(actual < (value as any))) return false;
    if (comparison[2] === "<=" && !(actual <= (value as any))) return false;
  }
  if (sql.includes("`leaseOwner` is null") && !(row.leaseOwner == null || row.leaseExpiresAt == null || row.leaseExpiresAt <= new Date())) return false;
  if (sql.includes("`leaseExpiresAt` > NOW()") && !(row.leaseExpiresAt > new Date())) return false;
  return true;
}
function resolvedValues(values: any, row: any) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => {
    if (value && typeof value === "object" && "queryChunks" in value) {
      const query = dialect.sqlToQuery(value as any).sql;
      if (query.includes("DATE_ADD")) return [key, new Date(Date.now() + 75_000)];
      if (query.includes("+ 1")) return [key, row.leaseVersion + 1];
      return [key, row[key]];
    }
    return [key, value];
  }));
}
function mockDb() {
  const instance: any = {
    select: () => ({ from(table: any) {
      let filter: any;
      const builder: any = {
        where(condition: any) { filter = condition; return builder; },
        orderBy() { return builder; }, limit() { return builder; },
        then(resolve: any, reject: any) {
          const rows = table === backupRuns ? [run] : logs;
          return Promise.resolve(rows.filter(row => !filter || matches(filter, row)).map(row => ({ ...row }))).then(resolve, reject);
        },
      };
      return builder;
    } }),
    update: (table: any) => ({ set(values: any) { return { async where(condition: any) {
      const rows = table === backupRuns ? [run] : logs;
      let affected = 0;
      for (const row of rows) if (matches(condition, row)) { Object.assign(row, resolvedValues(values, row)); affected++; }
      writes.push({ table: table === backupRuns ? "run" : "log", values, affected });
      return [{ affectedRows: affected }];
    } }; } }),
    transaction: (fn: any) => fn(instance),
    insert: () => ({ values: vi.fn() }),
  };
  return instance;
}
beforeEach(() => {
  vi.resetAllMocks();
  process.env.DATABASE_URL = "mysql://mock:mock@localhost:3306/isolated_mock";
  inventory = ["items"]; currentDdl = ddl; queryHook = undefined; writes = [];
  run = { id: "backup-test", backupLogId: 1, activeSlot: 1, status: "ACTIVE", phase: "DATABASE",
    leaseOwner: null, leaseExpiresAt: null, leaseVersion: 0, progressProtocol: 2, planJson: plan, manifestKey: null,
    currentTableIndex: 0, currentTableOffset: 0, chunksCreated: 0, rowsExported: 0,
    manifestJson: JSON.stringify({ version: 1, runId: "backup-test", startedAt: new Date().toISOString(), snapshotNote: "mock", chunks: [] }),
    databaseChecksum: null, codeChecksum: null, codeKey: null, codeUrl: null, lastError: null,
    createdAt: new Date(Date.now() - 3 * 86400_000), updatedAt: new Date(),
  };
  logs = [{ id: 1, status: "running", errorMessage: "old error", startedAt: run.createdAt }];
  db = mockDb(); mocks.getDb.mockResolvedValue(db);
  mocks.put.mockImplementation(async (key: string) => ({ key, url: `https://storage.invalid/${key}` }));
  mocks.connect.mockImplementation(async () => ({ destroy: vi.fn(), async query(query: string) {
    await queryHook?.(query);
    if (query === "SHOW TABLES") return [inventory.map(name => ({ Tables_in_mock: name }))];
    if (query.startsWith("SHOW CREATE TABLE")) return [[{ "Create Table": currentDdl }]];
    if (query.startsWith("SELECT *")) return [[{ id: 1 }]];
    throw new Error(`Query inesperada: ${query}`);
  } }));
});
afterEach(() => { vi.useRealTimers(); delete process.env.DATABASE_URL; });

describe("Protocolo 2 de progresso: mocks dinâmicos, sem SQL/storage reais", () => {
  it("dois callbacks concorrentes: só o dono exporta, sobe artefatos e incrementa", async () => {
    const entered = deferred(); const release = deferred();
    queryHook = async query => { if (query.startsWith("SELECT *")) { entered.resolve(); await release.promise; } };
    const first = advanceBackupRun("mock");
    await entered.promise;
    const second = await advanceBackupRun("mock");
    expect(second.leaseSkipped).toBe(true); expect(second.stepsProcessed).toBe(0);
    expect(mocks.put).not.toHaveBeenCalled(); expect(mocks.failLog).not.toHaveBeenCalled();
    release.resolve(); const winner = await first;
    expect(winner.stepsProcessed).toBe(1); expect(run.chunksCreated).toBe(1);
    expect(run.rowsExported).toBe(1); expect(run.status).toBe("ACTIVE");
    expect(mocks.put).toHaveBeenCalledTimes(2);
    const keys = mocks.put.mock.calls.map(call => call[0]);
    expect(keys[0]).toMatch(/database\/000001-[a-f0-9-]{36}-items-0\.sql$/);
    expect(keys[1]).toMatch(/manifests\/rev-[a-f0-9-]+\.json$/);
    expect(run.manifestKey).toBe(keys[1]); expect(run.leaseOwner).toBeNull();
  });
  it("lease expirado durante upload: não confirma nem falha a execução do novo dono", async () => {
    const uploading = deferred(); const release = deferred();
    mocks.put.mockImplementationOnce(async (key: string) => { uploading.resolve(); await release.promise; return { key, url: "https://mock.invalid" }; });
    const first = advanceBackupRun("mock"); await uploading.promise;
    run.leaseOwner = "new-owner"; run.leaseVersion++; run.leaseExpiresAt = new Date(Date.now() + 75_000);
    run.chunksCreated = 7; run.rowsExported = 77;
    release.resolve(); const stale = await first;
    expect(stale.leaseSkipped).toBe(true); expect(stale.chunksCreated).toBe(7);
    expect(stale.stepsProcessed).toBe(0); expect(run.leaseOwner).toBe("new-owner");
    expect(run.status).toBe("ACTIVE"); expect(run.lastError).toBeNull();
    expect(writes.filter(w => w.table === "log")).toHaveLength(0);
  });
  it("erro tardio de I/O não marca FAILED nem modifica o log do novo dono", async () => {
    const entered = deferred(); const release = deferred();
    queryHook = async query => { if (query.startsWith("SELECT *")) { entered.resolve(); await release.promise; throw new Error("late IO error"); } };
    const first = advanceBackupRun("mock"); await entered.promise;
    run.leaseOwner = "winner"; run.leaseVersion++; run.leaseExpiresAt = new Date(Date.now() + 75_000);
    release.resolve(); const stale = await first;
    expect(stale.leaseSkipped).toBe(true); expect(run.status).toBe("ACTIVE");
    expect(run.lastError).toBeNull(); expect(mocks.put).not.toHaveBeenCalled();
    expect(logs[0].status).toBe("running");
  });
  it("callback esgota 45s, retorna sem FAIL e I/O tardio não confirma manifesto", async () => {
    vi.useFakeTimers();
    const entered = deferred(); const release = deferred();
    mocks.put.mockImplementationOnce(async (key: string) => { entered.resolve(); await release.promise; return { key, url: "https://mock.invalid" }; });
    const callback = advanceBackupRunBatch("mock", 8); await entered.promise;
    await vi.advanceTimersByTimeAsync(45_000);
    const receipt = await callback;
    expect(receipt.timedOut).toBe(true); expect(receipt.stepsProcessed).toBe(0);
    expect(run.chunksCreated).toBe(0); expect(run.status).toBe("ACTIVE"); expect(run.leaseOwner).toBeNull();
    release.resolve(); await Promise.resolve();
    expect(run.chunksCreated).toBe(0); expect(mocks.put).toHaveBeenCalledTimes(1);
  });
  it("detecta inventário deslocado e DDL divergente antes de novo artefato", async () => {
    inventory = ["items", "new_table"];
    await expect(advanceBackupRun("mock")).rejects.toThrow("Inventário de tabelas mudou");
    expect(run.status).toBe("FAILED"); expect(mocks.put).not.toHaveBeenCalled();
  });
  it("detecta DDL selecionado divergente e preserva razão auditável", async () => {
    currentDdl += " ENGINE=InnoDB";
    await expect(advanceBackupRun("mock")).rejects.toThrow("Schema de items mudou");
    expect(run.lastError).toContain("Schema de items"); expect(mocks.put).not.toHaveBeenCalled();
  });
  it("legado parcial exige ciclo novo: nenhum SHOW TABLES nem novo artefato", async () => {
    run.progressProtocol = 1; run.planJson = null; run.chunksCreated = 12;
    await expect(advanceBackupRun("mock")).rejects.toThrow("Ciclo legado protocolo 1");
    expect(run.status).toBe("FAILED"); expect(run.chunksCreated).toBe(12);
    expect(mocks.connect).not.toHaveBeenCalled(); expect(mocks.put).not.toHaveBeenCalled();
    expect(logs[0].errorMessage).toContain("Não reordenar");
  });
  it("congela DDL/inventário somente uma vez, ORDER BY PK e manifesto v1", async () => {
    run.planJson = null;
    const queries: string[] = []; queryHook = async query => { queries.push(query); };
    const receipt = await advanceBackupRun("mock");
    expect(JSON.parse(run.planJson!).version).toBe(2); expect(receipt.protocolVersion).toBe(2);
    expect(queries.filter(query => query.startsWith("SHOW CREATE TABLE"))).toHaveLength(2);
    expect(queries).toContain("SELECT * FROM `items` ORDER BY `id` LIMIT 10000 OFFSET 0");
    expect(JSON.parse(run.manifestJson!).version).toBe(1);
  });
  it("não transforma a idade do ciclo em falha de um log com progresso recente", async () => {
    expect(await reconcileStaleBackupRuns()).toBe(0);
    expect(run.status).toBe("ACTIVE"); expect(logs[0].status).toBe("running");
  });
  it("aquisição/liberação não alteram updatedAt de progresso e rejeitam lease expirado", async () => {
    const originalUpdatedAt = run.updatedAt;
    const lease = await claimBackupLease(db, { ...run });
    expect(lease).not.toBeNull(); expect(run.updatedAt).toEqual(originalUpdatedAt);
    run.leaseExpiresAt = new Date(Date.now() - 1);
    await releaseBackupLease(db, lease!);
    expect(run.leaseOwner).toBe(lease!.owner);
  });
  it("lote valida limite 8 e helper interrompe operação nunca resolvida", async () => {
    await expect(advanceBackupRunBatch("mock", 9)).rejects.toThrow("Quantidade");
    vi.useFakeTimers();
    const timeout = beforeDeadline(() => new Promise(() => {}), Date.now() + 45_000);
    const assertion = expect(timeout).rejects.toBeInstanceOf(BackupDeadlineError);
    await vi.advanceTimersByTimeAsync(45_000); await assertion;
  });
  it("lote nunca excede 8 passos e usa uma única versão de lease", async () => {
    mocks.connect.mockImplementation(async () => ({ destroy: vi.fn(), async query(query: string) {
      if (query === "SHOW TABLES") return [[{ Tables_in_mock: "items" }]];
      if (query.startsWith("SHOW CREATE TABLE")) return [[{ "Create Table": ddl }]];
      if (query.startsWith("SELECT *")) return [Array.from({ length: 10_000 }, (_, id) => ({ id }))];
    } }));
    const result = await advanceBackupRunBatch("mock", 8);
    expect(result.stepsProcessed).toBe(8); expect(run.chunksCreated).toBe(8);
    expect(run.currentTableOffset).toBe(80_000); expect(run.leaseVersion).toBe(1);
    expect(mocks.put).toHaveBeenCalledTimes(16);
  });
  it("lease expirado sem sucessor também impede commit/falha/release tardios", async () => {
    mocks.put.mockImplementationOnce(async (key: string) => {
      run.leaseExpiresAt = new Date(Date.now() - 1);
      return { key, url: "https://mock.invalid" };
    });
    const result = await advanceBackupRun("mock");
    expect(result.leaseSkipped).toBe(true); expect(run.status).toBe("ACTIVE");
    expect(run.chunksCreated).toBe(0); expect(logs[0].status).toBe("running");
  });
  it("reconcilia pelo updatedAt antigo e não toma lease de outro callback", async () => {
    run.updatedAt = new Date(Date.now() - 27 * 3600_000);
    run.leaseOwner = "busy"; run.leaseExpiresAt = new Date(Date.now() + 75_000);
    expect(await reconcileStaleBackupRuns()).toBe(0); expect(run.status).toBe("ACTIVE");
    run.leaseExpiresAt = new Date(Date.now() - 1);
    expect(await reconcileStaleBackupRuns()).toBe(1); expect(run.status).toBe("FAILED");
    expect(logs[0].status).toBe("failed");
  });
  it("conclusão atômica limpa erro no run/log e referencia ZIP versionado", async () => {
    run.phase = "CODE"; run.currentTableIndex = 1;
    const result = await advanceBackupRun("mock");
    expect(result.status).toBe("COMPLETE"); expect(result.stepsProcessed).toBe(1);
    expect(run.activeSlot).toBeNull(); expect(run.leaseOwner).toBeNull();
    expect(run.lastError).toBeNull(); expect(logs[0].errorMessage).toBeNull();
    expect(logs[0].status).toBe("success");
    expect(run.codeKey).toMatch(/code\/[a-f0-9-]{36}\/abrwf-source\.zip$/);
    expect(JSON.parse(run.manifestJson!).code.key).toBe(run.codeKey);
    expect(run.manifestKey).toContain("/manifests/rev-");
  });
  it("globs reais excluem .env/config/credenciais em raiz e diretórios aninhados", async () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "backup-exclusion-test-"));
    try {
      const files = ["server.ts", "nested/good.ts", ".env", ".env.example", "backup.env", ".project-config.json",
        "nested/.env", "nested/.env.production", "nested/.project-config.json", ".manus/settings.json",
        "nested/.manus/settings.json", "github-credentials", "nested/githubcredentials.json", ".git-credentials",
        "nested/private.pem", "nested/token.key"];
      for (const name of files) { fs.mkdirSync(path.dirname(path.join(fixture, name)), { recursive: true }); fs.writeFileSync(path.join(fixture, name), "fixture only"); }
      const actual = await vi.importActual<typeof import("archiver")>("archiver");
      const archive = actual.default("zip");
      const entries: string[] = [];
      archive.on("entry", entry => entries.push(entry.name));
      archive.resume();
      archive.glob("**/*", { cwd: fixture, ignore: CODE_ARCHIVE_EXCLUSIONS, dot: true });
      await archive.finalize();
      expect(entries.filter(name => !name.endsWith("/")).sort()).toEqual(["nested/good.ts", "server.ts"]);
    } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
  });
});
