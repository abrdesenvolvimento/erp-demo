import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTHORIZED_RESTORE_RUN,
  executeIncrementalRestore,
  parseRestoreArguments,
  sanitizedRestoreError,
  validateChunkSql,
  validateRestoreTarget,
  type RestoreConnection,
} from "./restoreExecution";
import type { BackupManifest, CompletedBackupRun } from "./restoreWorkflow";

const hash = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");
const target = "mysql://test:secret@127.0.0.1:3407/abrwf_restore_mock";
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))); });
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "restore-unit-")); roots.push(root);
  const runId = AUTHORIZED_RESTORE_RUN;
  const sql = "-- producer\nDROP TABLE IF EXISTS `products`;\nCREATE TABLE `products` (`id` int NOT NULL, `companyId` int, `name` varchar(200), PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;\nINSERT INTO `products` (`id`, `companyId`, `name`) VALUES (1, NULL, 'texto'), (2, 1, 'outro');\n";
  const data = Buffer.from(sql), code = Buffer.from("ZIP is opaque; never executed");
  const manifest: BackupManifest = {
    version: 1, runId, startedAt: "2026-11-07T00:00:00Z", snapshotNote: "test",
    chunks: [{ key: `backups/incremental/${runId}/database/000001-products-0.sql`, table: "products", offset: 0, rows: 2, bytes: data.length, checksum: hash(data) }],
    code: { key: `backups/incremental/${runId}/code/abrwf-source.zip`, bytes: code.length, checksum: hash(code) },
  };
  const manifestJson = JSON.stringify(manifest);
  const run: CompletedBackupRun = { id: runId, status: "COMPLETE", phase: "COMPLETE", activeSlot: null, manifestJson, databaseChecksum: hash(manifestJson), codeChecksum: manifest.code.checksum, codeKey: manifest.code.key, chunksCreated: 1, rowsExported: 2, lastError: null };
  const artifacts = new Map([[manifest.chunks[0].key, data], [manifest.code.key, code]]);
  const query = vi.fn(async (statement: string): Promise<any> => {
    if (statement.startsWith("SELECT @@hostname")) return [[{ serverHostname: os.hostname(), databaseName: "abrwf_restore_mock", sqlMode: "STRICT_TRANS_TABLES" }], []];
    if (statement.startsWith("SELECT (SELECT COUNT")) return [[{ n: 0 }], []];
    if (statement.startsWith("SELECT TABLE_NAME")) return [[{ tableName: "products", columnName: "id" }, { tableName: "products", columnName: "companyId" }], []];
    if (statement.includes("duplicate_groups")) return [[{ n: 0 }], []];
    if (statement.startsWith("SELECT COUNT(*)")) return [[{ n: 2 }], []];
    return [{ affectedRows: 2 }, []];
  });
  const connection: RestoreConnection = { query, end: vi.fn(async () => undefined) };
  return { root, run, manifest, artifacts, query, connection, options: { runId, confirmRun: runId, apply: true }, deps: { stagingRoot: root, restoreUrl: target, loadRun: vi.fn(async () => run), download: vi.fn(async (key: string) => artifacts.get(key)!), connect: vi.fn(async () => connection) } };
}

const tables = new Set(["products", "sales"]);
const chunk = { table: "products", offset: 0, rows: 1 };
const ddl = "CREATE TABLE `products` (`id` int NOT NULL, `name` text, PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

describe("restore CLI authorization / target isolation", () => {
  it("requires explicit run and exact double confirmation for apply; dry-run is default", () => {
    expect(parseRestoreArguments(["--run", AUTHORIZED_RESTORE_RUN]).apply).toBe(false);
    expect(() => parseRestoreArguments([])).toThrow("--run");
    expect(() => parseRestoreArguments(["--run", AUTHORIZED_RESTORE_RUN, "--apply"])).toThrow("Escrita exige");
    expect(() => parseRestoreArguments(["--run", AUTHORIZED_RESTORE_RUN, "--confirm-run", "backup-1700000000000-abc12345", "--apply"])).toThrow("coincidir");
    expect(() => parseRestoreArguments(["--run", "backup-1700000000000-abc12345", "--confirm-run", "backup-1700000000000-abc12345", "--apply"])).toThrow("ciclo aprovado");
    expect(() => parseRestoreArguments(["--run", AUTHORIZED_RESTORE_RUN, "--apply", "--dry-run"])).toThrow("incompatíveis");
    expect(() => parseRestoreArguments(["--run", AUTHORIZED_RESTORE_RUN, "--target-url", target])).toThrow("não reconhecido");
  });
  it("blocks missing env, remote hosts, unsafe schemas, url options and normalized production destination", () => {
    expect(() => validateRestoreTarget(undefined, target)).toThrow("RESTORE_DATABASE_URL");
    for (const host of ["prod.example.com", "127.0.0.2", "0.0.0.0", "localhost.", "127.0.0.1.evil"]) expect(() => validateRestoreTarget(target.replace("127.0.0.1", host))).toThrow();
    for (const name of ["erp", "abrwf_restore_x/y", "abrwf_restore_X", "abrwf_restore_x%2Fprod"]) expect(() => validateRestoreTarget(target.replace("abrwf_restore_mock", name))).toThrow();
    expect(() => validateRestoreTarget(target + "?multipleStatements=true")).toThrow();
    expect(() => validateRestoreTarget(target, target.replace("127.0.0.1", "localhost").replace("test:secret", "other:pass"))).toThrow("coincide");
    for (const host of ["127.0.0.1", "localhost", "[::1]"]) expect(validateRestoreTarget(target.replace("127.0.0.1", host))).toMatchObject({ multipleStatements: false, dateStrings: true, timezone: "Z" });
  });
});

describe("safe dump tokenizer / producer grammar", () => {
  it("skips exact legacy DROP and ignores TiDB annotation; keywords inside literals are data", () => {
    const safe = `-- backup\nDROP TABLE IF EXISTS \`products\`;\n${ddl.replace("PRIMARY KEY (`id`)", "PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */")}\nINSERT INTO \`products\` (\`id\`, \`name\`) VALUES (1, 'DROP DATABASE; \\' ; -- \\\\ data');`;
    const result = validateChunkSql(safe, chunk, tables);
    expect(result.rows).toBe(1); expect(result.skippedDrops).toBe(1);
    expect(result.statements).toHaveLength(2);
    expect(result.statements[0]).not.toContain("CLUSTERED");
    expect(result.statements.every(statement => !statement.startsWith("DROP"))).toBe(true);
  });
  it("supports producer dates, decimals, NULL, escaped/doubled quotes and hex buffers", () => {
    const sql = `${ddl} INSERT INTO \`products\` (\`id\`, \`name\`) VALUES (1, X'00aaff'), (2, NULL), (3, 'it''s; ok'), (4, -1.25e+2);`;
    const result = validateChunkSql(sql, { ...chunk, rows: 4 }, tables);
    expect(result.rows).toBe(4);
    expect(result.statements[1]).toContain("X'00aaff'");
  });
  it("accepts SHOW CREATE timestamp defaults and rejects arbitrary default functions", () => {
    const valid = ddl.replace("`name` text", "`name` text, `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    expect(validateChunkSql(valid, { ...chunk, rows: 0 }, tables).statements).toHaveLength(1);
    expect(() => validateChunkSql(ddl.replace("`name` text", "`name` varchar(20) DEFAULT (SLEEP(1))"), { ...chunk, rows: 0 }, tables)).toThrow("DDL");
  });
  it.each([
    "USE `prod`;", "SET FOREIGN_KEY_CHECKS=0;", "CREATE DATABASE `other`;", "DROP DATABASE `other`;", "TRUNCATE `products`;", "REPLACE INTO `products` VALUES (1);", "UPDATE `products` SET `id`=2;", "GRANT ALL ON *.* TO 'x';", "DELIMITER $$", "/*!50000 DROP DATABASE prod */;", "CREATE TRIGGER `t` BEFORE INSERT ON `products` FOR EACH ROW SET @x=1;",
  ])("rejects unsafe statement %s", sql => { expect(() => validateChunkSql(ddl + sql, { ...chunk, rows: 0 }, tables)).toThrow(); });
  it.each([
    "INSERT INTO `sales` (`id`) VALUES (1);", "INSERT INTO `prod`.`products` (`id`) VALUES (1);", "INSERT IGNORE INTO `products` (`id`) VALUES (1);", "INSERT INTO `products` (`id`) SELECT 1;", "INSERT INTO `products` (`id`) VALUES ((SELECT 1));", "INSERT INTO `products` (`id`) VALUES (1) ON DUPLICATE KEY UPDATE `id`=2;", "INSERT INTO `products` (`id`) VALUES (LOAD_FILE('/etc/passwd'));", "INSERT INTO `products` (`id`) VALUES (1) INTO OUTFILE '/tmp/x';",
  ])("rejects INSERT extension/other target %s", sql => { expect(() => validateChunkSql(ddl + sql, chunk, tables)).toThrow(); });
  it("rejects missing tuple counts, malformed quoting, wrong first-chunk DDL and qualified foreign refs", () => {
    expect(() => validateChunkSql(ddl, chunk, tables)).toThrow("tuplas");
    expect(() => validateChunkSql(ddl + "INSERT INTO `products` (`id`) VALUES ('x);", chunk, tables)).toThrow("Aspas");
    expect(() => validateChunkSql("DROP TABLE IF EXISTS `sales`;" + ddl, { ...chunk, rows: 0 }, tables)).toThrow("DROP");
    expect(() => validateChunkSql(ddl, { ...chunk, offset: 100, rows: 0 }, tables)).toThrow("CREATE");
    expect(() => validateChunkSql(ddl.replace("PRIMARY KEY (`id`)", "FOREIGN KEY (`id`) REFERENCES `prod`.`sales` (`id`)"), { ...chunk, rows: 0 }, tables)).toThrow();
    expect(() => validateChunkSql(ddl.replace("ENGINE=InnoDB", "ENGINE=FEDERATED CONNECTION='mysql://prod'"), { ...chunk, rows: 0 }, tables)).toThrow();
  });
});

describe("execution orchestration with mocks only", () => {
  it("downloads ALL, verifies and audits before any target connection; never executes DROP", async () => {
    const f = await fixture();
    f.deps.connect.mockImplementation(async () => {
      expect(f.deps.download).toHaveBeenCalledTimes(2);
      expect(await fs.readFile(path.join(f.root, f.run.id, "source.zip"))).toEqual(f.artifacts.get(f.manifest.code.key));
      return f.connection;
    });
    const result = await executeIncrementalRestore(f.options, f.deps);
    expect(result.status).toBe("RESTORED"); expect(result.tables).toEqual([{ table: "products", expected: 2, actual: 2, match: true, duplicateIdGroups: 0 }]);
    expect(f.query.mock.calls.some(([sql]) => /^DROP/i.test(sql))).toBe(false);
    expect(f.query.mock.calls.at(-1)?.[0]).toBe("SET SESSION FOREIGN_KEY_CHECKS = 1");
    expect((await fs.stat(path.join(f.root, f.run.id))).mode & 0o777).toBe(0o700);
    expect((await fs.stat(result.outputPath)).mode & 0o777).toBe(0o600);
    const disk = await fs.readFile(result.outputPath, "utf8");
    expect(disk).not.toContain("secret"); expect(disk).not.toContain("mysql://"); expect(disk).not.toContain("texto");
  });
  it("dry-run fully verifies but never connects, and retries rehash private disk cache", async () => {
    const f = await fixture();
    expect((await executeIncrementalRestore({ runId: f.run.id, apply: false }, f.deps)).status).toBe("VERIFIED");
    expect(f.deps.connect).not.toHaveBeenCalled();
    f.deps.download.mockClear();
    expect((await executeIncrementalRestore({ runId: f.run.id, apply: false }, f.deps)).status).toBe("VERIFIED");
    expect(f.deps.download).not.toHaveBeenCalled();
    await fs.writeFile(path.join(f.root, f.run.id, "000001.sql"), "tampered");
    expect((await executeIncrementalRestore(f.options, f.deps)).status).toBe("FAILED");
    expect(f.deps.connect).not.toHaveBeenCalled();
  });
  it("bad last artifact blocks all target connections", async () => {
    const f = await fixture(); f.artifacts.set(f.manifest.code.key, Buffer.from("corrupt"));
    const result = await executeIncrementalRestore(f.options, f.deps);
    expect(result.status).toBe("FAILED"); expect(f.deps.connect).not.toHaveBeenCalled();
  });
  it("SQL injection with a valid checksum is rejected before target connection", async () => {
    const f = await fixture();
    const bad = Buffer.from(f.artifacts.get(f.manifest.chunks[0].key)!.toString() + "USE `prod`;\n");
    f.artifacts.set(f.manifest.chunks[0].key, bad);
    f.manifest.chunks[0].bytes = bad.length; f.manifest.chunks[0].checksum = hash(bad);
    f.run.manifestJson = JSON.stringify(f.manifest); f.run.databaseChecksum = hash(f.run.manifestJson);
    expect((await executeIncrementalRestore(f.options, f.deps)).status).toBe("FAILED"); expect(f.deps.connect).not.toHaveBeenCalled();
  });
  it.each(["nonempty", "wrong-host", "wrong-schema", "no-backslash", "ansi-quotes"])("rejects %s target session before any modifying SQL", async kind => {
    const f = await fixture();
    const original = f.query.getMockImplementation()!;
    f.query.mockImplementation(async sql => {
      if (sql.startsWith("SELECT @@hostname")) return [[{ serverHostname: kind === "wrong-host" ? "prod-host" : os.hostname(), databaseName: kind === "wrong-schema" ? "prod" : "abrwf_restore_mock", sqlMode: kind === "no-backslash" ? "NO_BACKSLASH_ESCAPES" : kind === "ansi-quotes" ? "ANSI_QUOTES" : "" }], []];
      if (kind === "nonempty" && sql.startsWith("SELECT (SELECT COUNT")) return [[{ n: 1 }], []];
      return original(sql);
    });
    const result = await executeIncrementalRestore(f.options, f.deps);
    expect(result.status).toBe("FAILED");
    expect(f.query.mock.calls.every(([sql]) => sql.startsWith("SELECT"))).toBe(true);
    expect(f.connection.end).toHaveBeenCalled();
  });
  it("duplicate primary key fails, reenables FK in finally and hides driver SQL/values", async () => {
    const f = await fixture(), original = f.query.getMockImplementation()!;
    f.query.mockImplementation(async sql => {
      if (sql.startsWith("INSERT")) throw Object.assign(new Error("Duplicate entry 'PERSON SECRET' INSERT ... mysql://user:password@prod/db"), { code: "ER_DUP_ENTRY", errno: 1062, sqlState: "23000", sql });
      return original(sql);
    });
    const result = await executeIncrementalRestore(f.options, f.deps);
    expect(result.status).toBe("FAILED"); expect(result.error).toContain("ER_DUP_ENTRY"); expect(result.error).not.toContain("PERSON");
    expect(f.query.mock.calls.at(-1)?.[0]).toBe("SET SESSION FOREIGN_KEY_CHECKS = 1");
  });
  it("preserves actual/expected audit counts on mismatch", async () => {
    const f = await fixture(), original = f.query.getMockImplementation()!;
    f.query.mockImplementation(async sql => sql === "SELECT COUNT(*) AS n FROM `products`" ? [[{ n: 1 }], []] : original(sql));
    const result = await executeIncrementalRestore(f.options, f.deps);
    expect(result.status).toBe("FAILED"); expect(result.tables[0]).toMatchObject({ expected: 2, actual: 1, match: false });
  });
  it("counts only confirmed cross-company pairs and records nullable legacy pairs separately", async () => {
    const f = await fixture(), original = f.query.getMockImplementation()!;
    f.query.mockImplementation(async sql => {
      if (sql.startsWith("SELECT TABLE_NAME")) return [[
        { tableName: "products", columnName: "id" },
        ...["sales", "saleItems"].flatMap(tableName => ["id", "companyId", ...(tableName === "saleItems" ? ["saleId"] : [])].map(columnName => ({ tableName, columnName }))),
      ], []];
      if (sql.includes("LEFT JOIN")) {
        if (sql.includes(" <> ")) {
          expect(sql).toContain("c.`companyId` IS NOT NULL AND p.`companyId` IS NOT NULL");
          return [[{ n: 1 }], []];
        }
        return [[{ n: sql.includes("c.`companyId` IS NULL OR p.`companyId` IS NULL") ? 3 : 2 }], []];
      }
      return original(sql);
    });
    const result = await executeIncrementalRestore(f.options, f.deps);
    expect(result.status).toBe("RESTORED");
    expect(result.relations).toContainEqual({ relation: "saleItems.saleId->sales.id", orphans: 2, confirmedCrossCompany: 1, nullableCompanySkipped: 3 });
    expect(result.warnings.some(warning => warning.includes("Integridade relacional"))).toBe(true);
  });
  it("rejects symlink cache and unsafe staging without target connection", async () => {
    const f = await fixture();
    await fs.mkdir(path.join(f.root, f.run.id), { mode: 0o700 });
    await fs.symlink("/etc/passwd", path.join(f.root, f.run.id, "000001.sql"));
    expect((await executeIncrementalRestore(f.options, f.deps)).status).toBe("FAILED"); expect(f.deps.connect).not.toHaveBeenCalled();
    await expect(executeIncrementalRestore(f.options, { ...f.deps, stagingRoot: process.cwd() })).rejects.toThrow("fora do projeto");
  });
  it("sanitizes untrusted errors even if they carry URLs, raw SQL or PII", () => {
    expect(sanitizedRestoreError(new Error("mysql://secret; INSERT PII"))).not.toMatch(/secret|INSERT|PII/);
    expect(sanitizedRestoreError({ code: "SQL contains secret", message: "private" })).toContain("UNCLASSIFIED");
  });
});
