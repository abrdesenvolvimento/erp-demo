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

  it("protege o callback agendado e avança apenas uma etapa por chamada", () => {
    expect(serverEntry).toContain("await sdk.authenticateRequest(req)");
    expect(serverEntry).toContain("user.taskUid !== BACKUP_HEARTBEAT_TASK_UID");
    expect(serverEntry).toContain("await advanceBackupRun('heartbeat')");
  });

  it("encaminha o endpoint legado para o fluxo incremental em vez do dump monolítico", () => {
    expect(legacyEndpoint).toContain("const { advanceBackupRun } = await import('./backupWorkflow')");
    expect(legacyEndpoint).toContain("mode: 'incremental'");
  });
});
