import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const workflow = fs.readFileSync(path.resolve(__dirname, "backupWorkflow.ts"), "utf-8");
const serverEntry = fs.readFileSync(path.resolve(__dirname, "_core/index.ts"), "utf-8");
const legacyEndpoint = fs.readFileSync(path.resolve(__dirname, "backupEndpoint.ts"), "utf-8");

describe("Contingência de backup incremental", () => {
  it("exporta o banco em partes persistidas e registra checksum no manifesto", () => {
    expect(workflow).toContain("const CHUNK_ROWS = 10_000");
    expect(workflow).toContain("LIMIT ${CHUNK_ROWS} OFFSET ${offset}");
    expect(workflow).toContain("manifest.chunks.push");
    expect(workflow).toContain("createHash(\"sha256\")");
    expect(workflow).toContain("manifest.json");
  });

  it("reconcilia execuções e logs antigos presos antes de iniciar novo ciclo", () => {
    expect(workflow).toContain("reconcileStaleBackupRuns");
    expect(workflow).toContain("Execução interrompida antes da conclusão; reconciliada pelo fluxo incremental.");
    expect(workflow).toContain("status: \"FAILED\"");
  });

  it("retoma a execução ativa e não abre novo backup completo logo após uma conclusão", () => {
    expect(workflow).toContain("const MIN_NEW_BACKUP_INTERVAL_MS = 20 * 60 * 60 * 1000");
    expect(workflow).toContain("if (active[0]) return active[0]");
    expect(workflow).toContain("if (elapsed < MIN_NEW_BACKUP_INTERVAL_MS) return null");
    expect(workflow).toContain(".orderBy(desc(backupRuns.updatedAt))");
    expect(workflow).toContain('status: "SKIPPED" as const');
  });

  it("usa uma trava persistida para impedir dois backups ativos em callbacks concorrentes", () => {
    expect(workflow).toContain("activeSlot: 1");
    expect(workflow).toContain("isDuplicateActiveRunError");
    expect(workflow).toContain("Outro callback já iniciou o ciclo incremental; execução reutilizada.");
    expect(workflow).toContain("activeSlot: null");
  });

  it("não inclui segredos e configurações locais no arquivo de código", () => {
    expect(workflow).toContain('".env"');
    expect(workflow).toContain('".env.*"');
    expect(workflow).toContain('".project-config.json"');
    expect(workflow).toContain('"**/*.pem"');
    expect(workflow).toContain('"**/*.key"');
  });

  it("protege o callback agendado e avança apenas uma etapa por chamada", () => {
    expect(serverEntry).toContain("await sdk.authenticateRequest(req)");
    expect(serverEntry).toContain("user.taskUid !== BACKUP_HEARTBEAT_TASK_UID");
    expect(serverEntry).toContain("await advanceBackupRun('heartbeat')");
  });

  it("encaminha o endpoint legado para o fluxo incremental em vez do dump monolítico", () => {
    expect(legacyEndpoint).toContain("const { advanceBackupRun } = await import('./backupWorkflow')");
    expect(legacyEndpoint).toContain("mode: 'incremental'");
  });

  it("protege disparos e metadados de backup por token explícito ou administrador", () => {
    expect(serverEntry).toContain("requireBackupAdmin");
    expect(legacyEndpoint).toContain("hasExplicitBackupSecret");
    expect(legacyEndpoint).toContain("requireBackupAccess");
    expect(legacyEndpoint).not.toContain("process.env.BACKUP_SECRET || process.env.JWT_SECRET");
  });
});
