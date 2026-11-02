import { createHash } from "crypto";

const RUN_PREFIX = "backups/incremental";
const CHUNK_ROWS = 10_000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export type BackupManifestChunk = {
  key: string;
  table: string;
  offset: number;
  rows: number;
  checksum: string;
  bytes: number;
};

export type BackupManifest = {
  version: 1;
  runId: string;
  startedAt: string;
  snapshotNote: string;
  chunks: BackupManifestChunk[];
  code: { key: string; checksum: string; bytes: number };
};

export type CompletedBackupRun = {
  id: string;
  status: string;
  phase: string;
  activeSlot: number | null;
  manifestJson: string | null;
  databaseChecksum: string | null;
  codeChecksum: string | null;
  codeKey: string | null;
  chunksCreated: number;
  rowsExported: number;
  lastError: string | null;
};

export type VerifiedArtifact = {
  key: string;
  data: Buffer;
  checksum: string;
  bytes: number;
};

export type ArtifactDownloader = (key: string) => Promise<Buffer>;

function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function requireSafeKey(key: unknown, prefix: string, label: string): asserts key is string {
  if (typeof key !== "string" || !key.startsWith(prefix) || key.includes("..") || key.includes("\\")) {
    throw new Error(`${label} fora do prefixo seguro do ciclo de backup.`);
  }
}

function requireChecksum(checksum: unknown, label: string): asserts checksum is string {
  if (typeof checksum !== "string" || !SHA256_PATTERN.test(checksum)) {
    throw new Error(`${label} deve conter um SHA-256 válido.`);
  }
}

function requireNonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${label} deve ser um inteiro não negativo.`);
  }
}

function parseChunkSequence(key: string, runId: string): number {
  const escapedRunId = runId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = key.match(new RegExp(`^${RUN_PREFIX}/${escapedRunId}/database/(\\d{6})-[^/]+-\\d+\\.sql$`));
  if (!match) throw new Error("Chave de chunk com formato inválido.");
  return Number(match[1]);
}

/**
 * Faz uma validação estrutural local do manifesto antes de qualquer download
 * ou conexão de escrita. Só aceita o formato completo v1 usado pelo backup.
 */
export function validateCompleteManifest(raw: unknown, runId: string): BackupManifest {
  if (!raw || typeof raw !== "object") throw new Error("Manifesto de backup ausente ou inválido.");
  const manifest = raw as Partial<BackupManifest>;
  const prefix = `${RUN_PREFIX}/${runId}/`;

  if (manifest.version !== 1) throw new Error("Versão de manifesto não suportada.");
  if (manifest.runId !== runId) throw new Error("runId do manifesto não corresponde à execução solicitada.");
  if (!Array.isArray(manifest.chunks) || manifest.chunks.length === 0) {
    throw new Error("Manifesto sem chunks de banco.");
  }
  if (!manifest.code) throw new Error("Manifesto sem arquivo de código; o backup não está completo.");

  const seenKeys = new Set<string>();
  const lastOffsetByTable = new Map<string, number>();
  const closedTables = new Set<string>();
  let lastTable: string | null = null;

  manifest.chunks.forEach((chunk, index) => {
    if (!chunk || typeof chunk !== "object") throw new Error(`Chunk ${index + 1} inválido.`);
    const typedChunk = chunk as BackupManifestChunk;
    requireSafeKey(typedChunk.key, `${prefix}database/`, `Chunk ${index + 1}`);
    requireChecksum(typedChunk.checksum, `Checksum do chunk ${index + 1}`);
    requireNonNegativeInteger(typedChunk.offset, `Offset do chunk ${index + 1}`);
    requireNonNegativeInteger(typedChunk.rows, `Linhas do chunk ${index + 1}`);
    requireNonNegativeInteger(typedChunk.bytes, `Tamanho do chunk ${index + 1}`);
    if (!typedChunk.table || !/^[A-Za-z0-9_]+$/.test(typedChunk.table)) {
      throw new Error(`Tabela inválida no chunk ${index + 1}.`);
    }
    if (typedChunk.bytes === 0) throw new Error(`Chunk ${index + 1} não pode ser vazio em bytes.`);
    if (seenKeys.has(typedChunk.key)) throw new Error(`Chave duplicada no chunk ${index + 1}.`);
    seenKeys.add(typedChunk.key);

    const sequence = parseChunkSequence(typedChunk.key, runId);
    if (sequence !== index + 1) throw new Error(`Sequência inválida no chunk ${index + 1}.`);
    if (!typedChunk.key.endsWith(`-${typedChunk.table}-${typedChunk.offset}.sql`)) {
      throw new Error(`Chave incompatível com tabela ou offset no chunk ${index + 1}.`);
    }

    if (lastTable !== null && typedChunk.table !== lastTable) closedTables.add(lastTable);
    if (closedTables.has(typedChunk.table)) {
      throw new Error(`Tabela ${typedChunk.table} reaparece fora da sequência de restauração.`);
    }

    const expectedOffset = lastOffsetByTable.get(typedChunk.table) ?? 0;
    if (typedChunk.offset !== expectedOffset) {
      throw new Error(`Offset inconsistente para a tabela ${typedChunk.table}.`);
    }
    lastOffsetByTable.set(typedChunk.table, typedChunk.offset + typedChunk.rows);
    lastTable = typedChunk.table;
  });

  requireSafeKey(manifest.code.key, `${prefix}code/`, "Arquivo de código");
  if (manifest.code.key !== `${prefix}code/abrwf-source.zip`) {
    throw new Error("Chave inesperada para o arquivo de código.");
  }
  requireChecksum(manifest.code.checksum, "Checksum do arquivo de código");
  requireNonNegativeInteger(manifest.code.bytes, "Tamanho do arquivo de código");
  if (manifest.code.bytes === 0) throw new Error("Arquivo de código vazio.");

  return manifest as BackupManifest;
}

/** Valida registro final, manifesto e contadores sem baixar nem executar SQL. */
export function validateCompletedBackupRun(run: CompletedBackupRun): BackupManifest {
  if (run.status !== "COMPLETE" || run.phase !== "COMPLETE") {
    throw new Error("A execução não está concluída e não pode ser restaurada.");
  }
  if (run.activeSlot !== null) throw new Error("A execução concluída ainda possui trava ativa.");
  if (run.lastError) throw new Error("A execução concluída contém erro registrado.");
  if (!run.manifestJson) throw new Error("A execução concluída não possui manifesto.");
  requireChecksum(run.databaseChecksum, "Checksum do manifesto gravado no banco");

  const manifestBytes = Buffer.from(run.manifestJson, "utf8");
  if (sha256(manifestBytes) !== run.databaseChecksum) {
    throw new Error("Checksum do manifesto não corresponde ao registro da execução.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(run.manifestJson);
  } catch {
    throw new Error("Manifesto armazenado no banco não contém JSON válido.");
  }
  const manifest = validateCompleteManifest(parsed, run.id);

  if (manifest.chunks.length !== run.chunksCreated) {
    throw new Error("Quantidade de chunks diverge entre manifesto e registro da execução.");
  }
  const rowsInManifest = manifest.chunks.reduce((sum, chunk) => sum + chunk.rows, 0);
  if (rowsInManifest !== run.rowsExported) {
    throw new Error("Quantidade de linhas diverge entre manifesto e registro da execução.");
  }
  if (run.codeKey !== manifest.code.key || run.codeChecksum !== manifest.code.checksum) {
    throw new Error("Referências do arquivo de código divergem entre manifesto e registro da execução.");
  }

  return manifest;
}

export function verifyArtifact(data: Buffer, expected: Pick<VerifiedArtifact, "key" | "checksum" | "bytes">): VerifiedArtifact {
  if (data.length !== expected.bytes) {
    throw new Error(`Tamanho inválido para ${expected.key}: esperado ${expected.bytes}, recebido ${data.length}.`);
  }
  const checksum = sha256(data);
  if (checksum !== expected.checksum) {
    throw new Error(`Checksum inválido para ${expected.key}.`);
  }
  return { key: expected.key, data, checksum, bytes: data.length };
}

/**
 * Baixa e verifica um artefato. O chamador deve executar esta etapa para todos
 * os arquivos antes de abrir qualquer conexão de escrita no banco de restauração.
 */
export async function downloadVerifiedArtifact(
  downloader: ArtifactDownloader,
  expected: Pick<VerifiedArtifact, "key" | "checksum" | "bytes">
): Promise<VerifiedArtifact> {
  const data = await downloader(expected.key);
  return verifyArtifact(data, expected);
}

/** Retorna a sequência completa a ser baixada e validada antes de uma restauração. */
export function createVerificationPlan(manifest: BackupManifest): Array<Pick<VerifiedArtifact, "key" | "checksum" | "bytes">> {
  return [
    ...manifest.chunks.map(chunk => ({ key: chunk.key, checksum: chunk.checksum, bytes: chunk.bytes })),
    { key: manifest.code.key, checksum: manifest.code.checksum, bytes: manifest.code.bytes },
  ];
}

export const RESTORE_CHUNK_ROWS = CHUNK_ROWS;
