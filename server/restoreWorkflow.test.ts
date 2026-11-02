import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import {
  createVerificationPlan,
  downloadVerifiedArtifact,
  validateCompletedBackupRun,
  validateCompleteManifest,
  verifyArtifact,
  type BackupManifest,
  type CompletedBackupRun,
} from "./restoreWorkflow";

const runId = "backup-1700000000000-abc12345";
const prefix = `backups/incremental/${runId}`;
const hash = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");
const digest = (seed: string) => hash(seed);

function validManifest(): BackupManifest {
  return {
    version: 1,
    runId,
    startedAt: "2026-11-01T00:00:00.000Z",
    snapshotNote: "Fixture de restauração controlada.",
    chunks: [
      {
        key: `${prefix}/database/000001-products-0.sql`,
        table: "products",
        offset: 0,
        rows: 2,
        checksum: digest("products"),
        bytes: 8,
      },
      {
        key: `${prefix}/database/000002-sales-0.sql`,
        table: "sales",
        offset: 0,
        rows: 1,
        checksum: digest("sales"),
        bytes: 5,
      },
    ],
    code: {
      key: `${prefix}/code/abrwf-source.zip`,
      checksum: digest("source"),
      bytes: 6,
    },
  };
}

function validRun(): CompletedBackupRun {
  const manifest = validManifest();
  const manifestJson = JSON.stringify(manifest);
  return {
    id: runId,
    status: "COMPLETE",
    phase: "COMPLETE",
    activeSlot: null,
    manifestJson,
    databaseChecksum: hash(manifestJson),
    codeChecksum: manifest.code.checksum,
    codeKey: manifest.code.key,
    chunksCreated: manifest.chunks.length,
    rowsExported: 3,
    lastError: null,
  };
}

describe("restaurador incremental — validações pré-escrita", () => {
  it("aceita uma execução completa coerente e monta o plano de verificação na ordem do manifesto", () => {
    const manifest = validateCompletedBackupRun(validRun());
    const plan = createVerificationPlan(manifest);

    expect(plan.map(item => item.key)).toEqual([
      `${prefix}/database/000001-products-0.sql`,
      `${prefix}/database/000002-sales-0.sql`,
      `${prefix}/code/abrwf-source.zip`,
    ]);
  });

  it("rejeita backup parcial, com erro ou contador divergente", () => {
    const partial = validRun();
    partial.status = "ACTIVE";
    expect(() => validateCompletedBackupRun(partial)).toThrow("não está concluída");

    const withError = validRun();
    withError.lastError = "Falha registrada";
    expect(() => validateCompletedBackupRun(withError)).toThrow("erro registrado");

    const inconsistent = validRun();
    inconsistent.rowsExported = 99;
    expect(() => validateCompletedBackupRun(inconsistent)).toThrow("Quantidade de linhas diverge");
  });

  it("rejeita manifesto com run, chave, sequência ou offsets inconsistentes", () => {
    const otherRun = validManifest();
    otherRun.runId = "backup-outra-execucao";
    expect(() => validateCompleteManifest(otherRun, runId)).toThrow("runId");

    const unsafeKey = validManifest();
    unsafeKey.chunks[0].key = `${prefix}/database/000001-../products-0.sql`;
    expect(() => validateCompleteManifest(unsafeKey, runId)).toThrow("prefixo seguro");

    const wrongSequence = validManifest();
    wrongSequence.chunks[1].key = `${prefix}/database/000003-sales-0.sql`;
    expect(() => validateCompleteManifest(wrongSequence, runId)).toThrow("Sequência inválida");

    const wrongOffset = validManifest();
    wrongOffset.chunks = [
      { ...wrongOffset.chunks[0], rows: 10_000 },
      {
        ...wrongOffset.chunks[0],
        key: `${prefix}/database/000002-products-9999.sql`,
        offset: 9_999,
        rows: 0,
        checksum: digest("products-end"),
      },
    ];
    expect(() => validateCompleteManifest(wrongOffset, runId)).toThrow("Offset inconsistente");
  });

  it("verifica tamanho e checksum do artefato antes de devolvê-lo ao restaurador", async () => {
    const data = Buffer.from("conteudo");
    const expected = { key: `${prefix}/database/000001-products-0.sql`, bytes: data.length, checksum: hash(data) };

    await expect(downloadVerifiedArtifact(async () => data, expected)).resolves.toMatchObject({ key: expected.key, bytes: data.length });
    expect(() => verifyArtifact(Buffer.from("alterado"), expected)).toThrow("Checksum inválido");
    expect(() => verifyArtifact(data, { ...expected, bytes: 99 })).toThrow("Tamanho inválido");
  });
});
