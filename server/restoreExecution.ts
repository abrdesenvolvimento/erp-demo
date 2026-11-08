import { constants as fsConstants, promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import {
  createVerificationPlan,
  downloadVerifiedArtifact,
  validateCompletedBackupRun,
  type ArtifactDownloader,
  type BackupManifest,
  type BackupManifestChunk,
  type CompletedBackupRun,
} from "./restoreWorkflow";

export const AUTHORIZED_RESTORE_RUN = "backup-1793858873889-a322fe51";
export const RESTORE_STAGING_ROOT = "/home/ubuntu/abrwf-restore";
export const MAX_ARTIFACT_BYTES = 128 * 1024 * 1024;
const SCHEMA = /^abrwf_restore_[a-z0-9_]+$/;
const RUN = /^backup-[0-9]{13}-[a-f0-9]{8}$/;

class RestoreGuardError extends Error {}
function guard(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RestoreGuardError(message);
}

/** Never include driver/storage messages: they can contain SQL values or signed URLs. */
export function sanitizedRestoreError(error: unknown): string {
  if (error instanceof RestoreGuardError) return error.message;
  const candidate = error as { code?: unknown; errno?: unknown; sqlState?: unknown } | null;
  const code = typeof candidate?.code === "string" && /^[A-Z_0-9]{1,64}$/.test(candidate.code) ? candidate.code : "UNCLASSIFIED";
  const state = typeof candidate?.sqlState === "string" && /^[A-Z0-9]{5}$/.test(candidate.sqlState) ? ` sqlState=${candidate.sqlState}` : "";
  const errno = Number.isSafeInteger(candidate?.errno) ? ` errno=${candidate!.errno}` : "";
  return `Falha técnica de restauração: ${code}${state}${errno}. Detalhes SQL/credenciais omitidos.`;
}

export type RestoreArguments = { runId: string; confirmRun?: string; apply: boolean; expectedServerHostname?: string };
export function parseRestoreArguments(args: string[]): RestoreArguments {
  const result: RestoreArguments = { runId: "", apply: false };
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    guard(!seen.has(arg), "Argumento duplicado.");
    seen.add(arg);
    if (arg === "--apply") result.apply = true;
    else if (arg === "--dry-run") { /* default */ }
    else {
      guard(["--run", "--confirm-run", "--expected-server-hostname"].includes(arg), "Argumento não reconhecido.");
      const value = args[++i];
      guard(value && !value.startsWith("--"), "Argumento obrigatório sem valor.");
      if (arg === "--run") result.runId = value;
      if (arg === "--confirm-run") result.confirmRun = value;
      if (arg === "--expected-server-hostname") result.expectedServerHostname = value;
    }
  }
  guard(!(seen.has("--apply") && seen.has("--dry-run")), "--apply e --dry-run são incompatíveis.");
  validateRestoreArguments(result);
  return result;
}
function validateRestoreArguments(options: RestoreArguments) {
  guard(RUN.test(options.runId), "--run deve conter um ID de backup válido.");
  guard(options.confirmRun === undefined || options.confirmRun === options.runId, "--confirm-run deve coincidir exatamente com --run.");
  if (options.apply) {
    guard(options.confirmRun === options.runId, "Escrita exige --run, --confirm-run idêntico e --apply.");
    guard(options.runId === AUTHORIZED_RESTORE_RUN, "Escrita autorizada apenas para o ciclo aprovado.");
  }
  guard(options.expectedServerHostname === undefined || /^[A-Za-z0-9_.-]{1,255}$/.test(options.expectedServerHostname), "Hostname de servidor inválido.");
}

function parseMysqlUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new RestoreGuardError("URL de banco inválida; valor omitido."); }
  guard(url.protocol === "mysql:", "Destino deve usar mysql:.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const port = Number(url.port || 3306);
  let database: string, user: string, password: string;
  try {
    database = decodeURIComponent(url.pathname.slice(1));
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch { throw new RestoreGuardError("Codificação da URL de banco inválida."); }
  guard(Number.isInteger(port) && port > 0 && port <= 65535, "Porta de banco inválida.");
  return { url, host, port, database, user, password };
}
function normalizedHost(host: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(host) ? "loopback" : host.replace(/\.$/, "");
}
export function validateRestoreTarget(restoreUrl: string | undefined, productionUrl?: string) {
  guard(restoreUrl, "RESTORE_DATABASE_URL explícito é obrigatório; DATABASE_URL nunca é fallback.");
  const target = parseMysqlUrl(restoreUrl);
  guard(["127.0.0.1", "localhost", "::1"].includes(target.host), "Destino bloqueado: apenas loopback literal é permitido.");
  guard(SCHEMA.test(target.database), "Schema deve corresponder a abrwf_restore_[a-z0-9_]+.");
  guard(!target.url.search && !target.url.hash && target.user.length > 0, "Opções extras na URL e usuário vazio não são permitidos.");
  if (productionUrl) {
    const production = parseMysqlUrl(productionUrl);
    guard(!(normalizedHost(target.host) === normalizedHost(production.host) && target.port === production.port && target.database.toLowerCase() === production.database.toLowerCase()), "Destino coincide com DATABASE_URL (host/porta/schema normalizados).");
  }
  return {
    host: target.host, port: target.port, user: target.user, password: target.password,
    database: target.database, multipleStatements: false as const, dateStrings: true as const,
    timezone: "Z", connectTimeout: 20_000, charset: "utf8mb4",
    supportBigNumbers: true, bigNumberStrings: true,
  };
}

type Token = { kind: "word" | "id" | "string" | "number" | "symbol"; value: string };
/** Comments are stripped, never forwarded. MySQL executable version comments are rejected. */
function tokenize(sql: string): Array<{ sql: string; tokens: Token[] }> {
  const statements: Array<{ sql: string; tokens: Token[] }> = [];
  let tokens: Token[] = [], parts: string[] = [];
  const push = (kind: Token["kind"], raw: string, value = raw) => { tokens.push({ kind, value }); parts.push(raw); };
  const finish = () => {
    if (tokens.length) statements.push({ sql: parts.map((part, index) =>
      index === 0 || (tokens[index].kind === "string" && keyword(tokens[index - 1], "X")) ? part : ` ${part}`
    ).join(""), tokens });
    tokens = []; parts = [];
  };
  for (let i = 0; i < sql.length;) {
    const c = sql[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "#" || (sql.startsWith("--", i) && (i + 2 === sql.length || /\s/.test(sql[i + 2])))) {
      const end = sql.indexOf("\n", i); i = end < 0 ? sql.length : end + 1; continue;
    }
    if (sql.startsWith("/*", i)) {
      guard(!sql.startsWith("/*!", i), "Comentário SQL executável não permitido.");
      const end = sql.indexOf("*/", i + 2); guard(end >= 0, "Comentário SQL não terminado.");
      i = end + 2; continue;
    }
    if (c === ";") { finish(); i++; continue; }
    if (c === "'" || c === '"' || c === "`") {
      const start = i++, quote = c;
      let closed = false, value = "";
      while (i < sql.length) {
        const next = sql[i++];
        if (next === "\\" && quote !== "`") { guard(i < sql.length, "Escape SQL não terminado."); value += next + sql[i++]; continue; }
        if (next === quote) {
          if (sql[i] === quote) { value += quote; i++; continue; }
          closed = true; break;
        }
        value += next;
      }
      guard(closed, "Aspas SQL não terminadas.");
      push(quote === "`" ? "id" : "string", sql.slice(start, i), value); continue;
    }
    const number = sql.slice(i).match(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) { push("number", number[0]); i += number[0].length; continue; }
    const word = sql.slice(i).match(/^[A-Za-z_][A-Za-z0-9_$]*/);
    if (word) { push("word", word[0], word[0].toUpperCase()); i += word[0].length; continue; }
    guard("(),=.".includes(c), "Token SQL não permitido.");
    push("symbol", c); i++;
  }
  guard(tokens.length === 0, "Toda instrução do dump deve terminar com ponto e vírgula.");
  return statements;
}
function keyword(token: Token | undefined, word: string) { return token?.kind === "word" && token.value === word; }
function identifier(token: Token | undefined, name?: string) {
  return token?.kind === "id" && /^[A-Za-z0-9_]+$/.test(token.value) && (name === undefined || token.value === name);
}
function symbol(token: Token | undefined, value: string) { return token?.kind === "symbol" && token.value === value; }
export type ValidatedChunk = { statements: string[]; rows: number; skippedDrops: number };

export function validateChunkSql(sql: string, chunk: Pick<BackupManifestChunk, "table" | "offset" | "rows">, manifestTables: ReadonlySet<string>): ValidatedChunk {
  guard(/^[A-Za-z0-9_]+$/.test(chunk.table) && manifestTables.has(chunk.table), "Tabela de chunk inválida.");
  const output: ValidatedChunk = { statements: [], rows: 0, skippedDrops: 0 };
  let creates = 0;
  for (const statement of tokenize(sql)) {
    const t = statement.tokens;
    if (keyword(t[0], "DROP")) {
      guard(chunk.offset === 0 && creates === 0 && output.statements.length === 0 && output.skippedDrops === 0 && t.length === 5 && keyword(t[1], "TABLE") && keyword(t[2], "IF") && keyword(t[3], "EXISTS") && identifier(t[4], chunk.table), "DROP legado inesperado; nunca será executado.");
      output.skippedDrops++; continue;
    }
    if (keyword(t[0], "CREATE")) {
      guard(chunk.offset === 0 && creates === 0 && output.statements.length === 0 && keyword(t[1], "TABLE") && identifier(t[2], chunk.table) && symbol(t[3], "("), "CREATE TABLE inesperado ou fora do primeiro chunk.");
      let depth = 0, bodyEnd = -1;
      for (let j = 3; j < t.length; j++) {
        if (symbol(t[j], "(")) depth++;
        if (symbol(t[j], ")") && --depth === 0) { bodyEnd = j; break; }
        guard(depth >= 0, "Parênteses DDL inválidos.");
      }
      guard(bodyEnd > 3, "Corpo CREATE TABLE inválido.");
      const ddlWords = new Set(["INT", "INTEGER", "TINYINT", "SMALLINT", "MEDIUMINT", "BIGINT", "DECIMAL", "NUMERIC", "FLOAT", "DOUBLE", "REAL", "BIT", "BOOL", "BOOLEAN", "DATE", "TIME", "YEAR", "DATETIME", "TIMESTAMP", "CHAR", "VARCHAR", "BINARY", "VARBINARY", "TEXT", "TINYTEXT", "MEDIUMTEXT", "LONGTEXT", "BLOB", "TINYBLOB", "MEDIUMBLOB", "LONGBLOB", "JSON", "ENUM", "SET", "UNSIGNED", "ZEROFILL", "NOT", "NULL", "DEFAULT", "CURRENT_TIMESTAMP", "AUTO_INCREMENT", "PRIMARY", "KEY", "UNIQUE", "INDEX", "CONSTRAINT", "FOREIGN", "REFERENCES", "ON", "UPDATE", "DELETE", "RESTRICT", "CASCADE", "NO", "ACTION", "COLLATE", "CHARACTER", "COMMENT", "USING", "BTREE"]);
      for (let j = 4; j < bodyEnd; j++) {
        const charsetValue = keyword(t[j - 1], "COLLATE") || (keyword(t[j - 1], "SET") && keyword(t[j - 2], "CHARACTER"));
        guard((t[j].kind !== "word" || ddlWords.has(t[j].value) || (charsetValue && /^[A-Z0-9_]+$/.test(t[j].value))) && !symbol(t[j], ".") && !symbol(t[j], "="), "Extensão DDL não permitida.");
        if (keyword(t[j], "UPDATE")) guard(keyword(t[j - 1], "ON") && ["CURRENT_TIMESTAMP", "RESTRICT", "CASCADE", "NO", "SET"].some(word => keyword(t[j + 1], word)), "UPDATE fora de cláusula DDL segura não permitido.");
        if (keyword(t[j], "DELETE")) guard(keyword(t[j - 1], "ON") && ["RESTRICT", "CASCADE", "NO", "SET"].some(word => keyword(t[j + 1], word)), "DELETE fora de cláusula DDL segura não permitido.");
        if (keyword(t[j], "REFERENCES")) guard(identifier(t[j + 1]) && manifestTables.has(t[j + 1].value) && symbol(t[j + 2], "("), "REFERENCES fora das tabelas do manifesto.");
      }
      let engine = false;
      for (let j = bodyEnd + 1; j < t.length;) {
        let option = t[j++];
        if (keyword(option, "DEFAULT")) option = t[j++];
        guard(option?.kind === "word" && ["ENGINE", "CHARSET", "COLLATE", "AUTO_INCREMENT", "ROW_FORMAT"].includes(option.value), "Opção CREATE TABLE não permitida.");
        guard(symbol(t[j++], "="), "Opção CREATE TABLE exige atribuição explícita.");
        const value = t[j++];
        if (option.value === "ENGINE") { guard(!engine && keyword(value, "INNODB"), "Somente ENGINE=InnoDB é permitido."); engine = true; }
        else if (option.value === "AUTO_INCREMENT") guard(value?.kind === "number" && /^\d+$/.test(value.value), "AUTO_INCREMENT inválido.");
        else guard(value?.kind === "word" && /^[A-Z0-9_]+$/.test(value.value) && (option.value !== "ROW_FORMAT" || ["DYNAMIC", "COMPACT", "REDUNDANT", "COMPRESSED"].includes(value.value)), "Valor de opção DDL inválido.");
      }
      guard(engine, "Dump deve declarar ENGINE=InnoDB.");
      creates++; output.statements.push(statement.sql); continue;
    }
    guard(keyword(t[0], "INSERT") && keyword(t[1], "INTO") && identifier(t[2], chunk.table) && symbol(t[3], "("), "Apenas CREATE TABLE e INSERT INTO da tabela exata são permitidos.");
    guard(chunk.offset > 0 || creates === 1, "INSERT antes de CREATE TABLE.");
    let j = 4, columns = 0;
    const names = new Set<string>();
    while (true) {
      guard(identifier(t[j]) && !names.has(t[j].value), "Colunas INSERT inválidas ou duplicadas."); names.add(t[j++].value); columns++;
      if (symbol(t[j], ")")) { j++; break; }
      guard(symbol(t[j++], ","), "Lista de colunas INSERT inválida.");
    }
    guard(keyword(t[j++], "VALUES"), "INSERT deve usar apenas VALUES literais.");
    while (true) {
      guard(symbol(t[j++], "("), "Tupla INSERT inválida.");
      for (let k = 0; k < columns; k++) {
        const value = t[j++];
        if (keyword(value, "X")) { guard(t[j]?.kind === "string" && /^[a-f0-9]*$/i.test(t[j].value) && t[j].value.length % 2 === 0, "Literal binário inválido."); j++; }
        else guard(value && (value.kind === "string" || value.kind === "number" || keyword(value, "NULL")), "Somente valores literais do produtor são permitidos.");
        guard(symbol(t[j++], k === columns - 1 ? ")" : ","), "Quantidade de valores INSERT divergente.");
      }
      output.rows++;
      if (j === t.length) break;
      guard(symbol(t[j++], ","), "Extensão INSERT não permitida.");
    }
    output.statements.push(statement.sql);
  }
  guard(chunk.offset !== 0 || creates === 1, "Primeiro chunk exige exatamente um CREATE TABLE.");
  guard(output.rows === chunk.rows, "Contagem de tuplas SQL diverge do manifesto.");
  return output;
}

export type RestoreConnection = {
  query(sql: string, values?: unknown[]): Promise<unknown>;
  end(): Promise<unknown>;
};
export type RestoreDependencies = {
  loadRun(runId: string): Promise<CompletedBackupRun>;
  download: ArtifactDownloader;
  connect(config: ReturnType<typeof validateRestoreTarget>): Promise<RestoreConnection>;
  productionUrl?: string;
  restoreUrl?: string;
  stagingRoot?: string; // Dependency injection for mock tests; no CLI override.
  progress?: (message: string) => void;
};
export type TableAudit = { table: string; expected: number; actual: number; match: boolean; duplicateIdGroups?: number };
export type RelationAudit = { relation: string; orphans: number; confirmedCrossCompany: number | null; nullableCompanySkipped: number | null };
export type RestoreAudit = {
  version: 1; runId: string; mode: "apply" | "dry-run"; status: "RUNNING" | "VERIFIED" | "RESTORED" | "FAILED";
  startedAt: string; finishedAt?: string; outputPath: string; expectedChunks?: number; expectedRows?: number;
  verifiedArtifacts: number; restoredChunks: number; skippedLegacyDrops: number; codeArchiveVerified: boolean;
  tables: TableAudit[]; relations: RelationAudit[]; warnings: string[]; error?: string;
  serverHostname?: string; targetDatabase?: string;
  snapshotNote: string;
};
async function privateDirectory(directory: string) {
  await fs.mkdir(directory, { mode: 0o700 }).catch(error => { if (error.code !== "EEXIST") throw error; });
  const stat = await fs.lstat(directory);
  guard(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid?.(), "Staging deve ser diretório privado do usuário, sem symlink.");
  await fs.chmod(directory, 0o700);
}
async function readPrivate(file: string, max: number): Promise<Buffer> {
  const handle = await fs.open(file, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    guard(stat.isFile() && stat.uid === process.getuid?.() && (stat.mode & 0o777) === 0o600 && stat.size <= max, "Cache deve ser arquivo privado regular dentro do limite de memória.");
    const data = await handle.readFile();
    guard(data.length <= max, "Artefato excede limite de memória."); return data;
  } finally { await handle.close(); }
}
async function writePrivate(file: string, data: Buffer | string) {
  const temp = `${file}.${randomUUID()}.tmp`;
  const handle = await fs.open(temp, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(data); await handle.sync(); } finally { await handle.close(); }
  try { await fs.rename(temp, file); } finally { await fs.rm(temp, { force: true }); }
}
async function queryRows(connection: RestoreConnection, sql: string, values?: unknown[]): Promise<Array<Record<string, any>>> {
  const result = await connection.query(sql, values) as [Array<Record<string, any>>, unknown];
  guard(Array.isArray(result[0]), "Resultado inesperado da consulta de auditoria."); return result[0];
}
function count(value: unknown): number {
  const n = Number(value); guard(Number.isSafeInteger(n) && n >= 0, "Contagem de auditoria inválida."); return n;
}
const qi = (name: string) => { guard(/^[A-Za-z0-9_]+$/.test(name), "Identificador inválido."); return `\`${name}\``; };
const CORE_TABLES = new Set(["companies", "products", "sales", "saleItems", "salonItems", "salonOrders", "salonOrderItems", "orders", "orderItems", "productMovements"]);
const RELATIONS = [
  ["saleItems", "saleId", "sales"], ["saleItems", "productId", "products"],
  ["productMovements", "productId", "products"], ["salonOrderItems", "orderId", "salonOrders"],
  ["salonOrderItems", "productId", "products"], ["salonOrders", "tableId", "salonTables"],
  ["salonOrders", "saleId", "sales"], ["salonOrderPayments", "orderId", "salonOrders"],
  ["salonItems", "orderId", "orders"], ["salonItems", "productId", "products"],
  ["orderItems", "orderId", "orders"], ["orderItems", "productId", "products"],
  ["orders", "saleId", "sales"], ["ifoodImportedOrders", "saleId", "sales"],
] as const;
async function auditDatabase(connection: RestoreConnection, manifest: BackupManifest, audit: RestoreAudit) {
  const metadata = await queryRows(connection, "SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()");
  const columns = new Map<string, Set<string>>();
  for (const row of metadata) {
    if (!columns.has(row.tableName)) columns.set(row.tableName, new Set());
    columns.get(row.tableName)!.add(row.columnName);
  }
  const expected = new Map<string, number>();
  for (const chunk of manifest.chunks) expected.set(chunk.table, (expected.get(chunk.table) || 0) + chunk.rows);
  for (const [table, rows] of expected) {
    const [record] = await queryRows(connection, `SELECT COUNT(*) AS n FROM ${qi(table)}`);
    const entry: TableAudit = { table, expected: rows, actual: count(record.n), match: count(record.n) === rows };
    if (CORE_TABLES.has(table) && columns.get(table)?.has("id")) {
      const [duplicates] = await queryRows(connection, `SELECT COUNT(*) AS n FROM (SELECT ${qi("id")} FROM ${qi(table)} GROUP BY ${qi("id")} HAVING COUNT(*) > 1) AS duplicate_groups`);
      entry.duplicateIdGroups = count(duplicates.n);
    }
    audit.tables.push(entry);
  }
  const relations: Array<readonly [string, string, string]> = [...RELATIONS];
  if (columns.get("companies")?.has("id")) {
    for (const table of expected.keys()) if (table !== "companies" && columns.get(table)?.has("companyId")) relations.push([table, "companyId", "companies"]);
  }
  for (const [child, fk, parent] of relations) {
    if (!columns.get(child)?.has(fk) || !columns.get(parent)?.has("id")) continue;
    const from = `FROM ${qi(child)} c LEFT JOIN ${qi(parent)} p ON c.${qi(fk)} = p.${qi("id")}`;
    const [orphans] = await queryRows(connection, `SELECT COUNT(*) AS n ${from} WHERE c.${qi(fk)} IS NOT NULL AND p.${qi("id")} IS NULL`);
    const relation: RelationAudit = { relation: `${child}.${fk}->${parent}.id`, orphans: count(orphans.n), confirmedCrossCompany: null, nullableCompanySkipped: null };
    if (columns.get(child)?.has("companyId") && columns.get(parent)?.has("companyId")) {
      const [cross] = await queryRows(connection, `SELECT COUNT(*) AS n ${from} WHERE p.${qi("id")} IS NOT NULL AND c.${qi("companyId")} IS NOT NULL AND p.${qi("companyId")} IS NOT NULL AND c.${qi("companyId")} <> p.${qi("companyId")}`);
      const [nullable] = await queryRows(connection, `SELECT COUNT(*) AS n ${from} WHERE p.${qi("id")} IS NOT NULL AND (c.${qi("companyId")} IS NULL OR p.${qi("companyId")} IS NULL)`);
      relation.confirmedCrossCompany = count(cross.n); relation.nullableCompanySkipped = count(nullable.n);
    }
    audit.relations.push(relation);
    if (relation.orphans || relation.confirmedCrossCompany) audit.warnings.push(`Integridade relacional a revisar: ${relation.relation}; somente contagens, sem registros.`);
  }
  audit.warnings.push("Backup lógico por tabelas, não snapshot transacional global; alertas relacionais são separados da fidelidade de restauração.");
  guard(audit.tables.every(table => table.match && !table.duplicateIdGroups), "Auditoria de contagem/duplicidade diverge do manifesto.");
}

/** Finite isolated restore. All download/checksum/syntax passes finish before connect(). */
export async function executeIncrementalRestore(options: RestoreArguments, deps: RestoreDependencies): Promise<RestoreAudit> {
  validateRestoreArguments(options);
  const target = options.apply || deps.restoreUrl ? validateRestoreTarget(deps.restoreUrl, deps.productionUrl) : undefined;
  const root = deps.stagingRoot || RESTORE_STAGING_ROOT;
  guard(path.isAbsolute(root) && !path.resolve(root).startsWith(path.resolve(process.cwd()) + path.sep) && path.resolve(root) !== path.resolve(process.cwd()), "Staging deve ficar fora do projeto.");
  await privateDirectory(root);
  const directory = path.join(root, options.runId);
  await privateDirectory(directory);
  const outputPath = path.join(directory, "result.json");
  const lockPath = path.join(directory, ".restore.lock");
  const lock = await fs.open(lockPath, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW, 0o600);
  const audit: RestoreAudit = {
    version: 1, runId: options.runId, mode: options.apply ? "apply" : "dry-run", status: "RUNNING",
    startedAt: new Date().toISOString(), outputPath, verifiedArtifacts: 0, restoredChunks: 0,
    skippedLegacyDrops: 0, codeArchiveVerified: false, tables: [], relations: [], warnings: [],
    snapshotNote: "Exportação sequencial de tabelas; não garante consistência de snapshot global.",
  };
  let connection: RestoreConnection | undefined;
  let sessionValidated = false;
  const save = () => writePrivate(outputPath, JSON.stringify(audit, null, 2) + "\n");
  try {
    await save();
    const run = await deps.loadRun(options.runId);
    guard(run.id === options.runId, "Registro consultado não corresponde ao --run.");
    let manifest: BackupManifest;
    try { manifest = validateCompletedBackupRun(run); } catch { throw new RestoreGuardError("Registro/manifesto concluído inválido (validação original recusada)."); }
    const plan = createVerificationPlan(manifest);
    guard(plan.every(item => item.bytes > 0 && item.bytes <= MAX_ARTIFACT_BYTES), "Artefato fora do limite de memória (128 MiB por arquivo).");
    audit.expectedChunks = manifest.chunks.length; audit.expectedRows = run.rowsExported;
    const files = plan.map((_, i) => path.join(directory, i === plan.length - 1 ? "source.zip" : `${String(i + 1).padStart(6, "0")}.sql`));
    for (let i = 0; i < plan.length; i++) {
      const expected = plan[i];
      const downloader: ArtifactDownloader = async key => {
        try { return await readPrivate(files[i], MAX_ARTIFACT_BYTES); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
        return deps.download(key);
      };
      const verified = await downloadVerifiedArtifact(downloader, expected);
      // Cache corruption fails closed; operator removes only the bad private file and retries.
      await writePrivate(files[i], verified.data);
      audit.verifiedArtifacts++;
      if (i === plan.length - 1) audit.codeArchiveVerified = true; // ZIP is never parsed, extracted, or executed.
      if ((i + 1) % 10 === 0 || i === plan.length - 1) { deps.progress?.(`Artefatos verificados: ${i + 1}/${plan.length}.`); await save(); }
    }
    const tables = new Set(manifest.chunks.map(chunk => chunk.table));
    for (let i = 0; i < manifest.chunks.length; i++) {
      const verified = await downloadVerifiedArtifact(() => readPrivate(files[i], MAX_ARTIFACT_BYTES), plan[i]);
      const validated = validateChunkSql(verified.data.toString("utf8"), manifest.chunks[i], tables);
      audit.skippedLegacyDrops += validated.skippedDrops;
      if ((i + 1) % 10 === 0 || i === manifest.chunks.length - 1) deps.progress?.(`Sintaxe segura: ${i + 1}/${manifest.chunks.length} chunks.`);
    }
    await save();
    if (!options.apply) { audit.status = "VERIFIED"; deps.progress?.("Dry-run concluído: nenhum banco de destino foi conectado e nenhum SQL executado."); }
    else {
      guard(target, "Destino explícito ausente.");
      connection = await deps.connect(target);
      const [session] = await queryRows(connection, "SELECT @@hostname AS serverHostname, DATABASE() AS databaseName, @@SESSION.sql_mode AS sqlMode");
      guard(session?.serverHostname === (options.expectedServerHostname || os.hostname()), "@@hostname não corresponde ao servidor local esperado.");
      guard(session?.databaseName === target.database && SCHEMA.test(session.databaseName), "DATABASE() não corresponde ao schema isolado autorizado.");
      guard(typeof session.sqlMode === "string" && !session.sqlMode.split(",").some((mode: string) => ["NO_BACKSLASH_ESCAPES", "ANSI_QUOTES"].includes(mode)), "sql_mode incompatível com os escapes do produtor.");
      const [objects] = await queryRows(connection, "SELECT (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()) + (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE()) + (SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()) + (SELECT COUNT(*) FROM information_schema.EVENTS WHERE EVENT_SCHEMA = DATABASE()) AS n");
      guard(count(objects.n) === 0, "Schema de destino deve existir e estar completamente vazio; não será limpo.");
      sessionValidated = true;
      audit.serverHostname = session.serverHostname; audit.targetDatabase = target.database;
      await connection.query("SET SESSION FOREIGN_KEY_CHECKS = 0");
      for (let i = 0; i < manifest.chunks.length; i++) {
        const verified = await downloadVerifiedArtifact(() => readPrivate(files[i], MAX_ARTIFACT_BYTES), plan[i]);
        const validated = validateChunkSql(verified.data.toString("utf8"), manifest.chunks[i], tables);
        for (const sql of validated.statements) await connection.query(sql); // one statement only; duplicate keys fail normally
        audit.restoredChunks++;
        if ((i + 1) % 10 === 0 || i === manifest.chunks.length - 1) { deps.progress?.(`Restauração isolada: ${i + 1}/${manifest.chunks.length} chunks.`); await save(); }
      }
      await auditDatabase(connection, manifest, audit);
      audit.status = "RESTORED";
    }
  } catch (error) {
    audit.status = "FAILED"; audit.error = sanitizedRestoreError(error);
    if (sessionValidated) audit.warnings.push("Destino isolado pode estar parcialmente restaurado. Não há rollback de DDL; uma nova tentativa exige novo schema vazio provisionado externamente.");
  } finally {
    if (connection) {
      if (sessionValidated) {
        try { await connection.query("SET SESSION FOREIGN_KEY_CHECKS = 1"); }
        catch (error) { audit.status = "FAILED"; audit.error = sanitizedRestoreError(error); }
      }
      try { await connection.end(); } catch (error) { audit.status = "FAILED"; audit.error ||= sanitizedRestoreError(error); }
    }
    audit.finishedAt = new Date().toISOString();
    try { await save(); } finally { await lock.close(); await fs.rm(lockPath, { force: true }); }
  }
  deps.progress?.(`Resultado: ${audit.status}. Auditoria privada: ${outputPath}`);
  return audit;
}
