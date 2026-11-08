import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

function handler(authenticateRequest: ReturnType<typeof vi.fn>) {
  const source = fs.readFileSync(path.join(process.cwd(), "server/_core/index.ts"), "utf8");
  const start = source.indexOf("  app.post('/api/scheduled/backup'");
  const end = source.indexOf("  // ==================== PRINT QUEUE", start);
  const route = source.slice(start, end).replace(/catch \(error: any\)/g, "catch (error)");
  const reconcile = vi.fn(async () => 0);
  const advance = vi.fn(async () => ({ protocolVersion: 2, stepsProcessed: 8 }));
  const health = vi.fn(async () => ({ notification: "NOT_NEEDED" }));
  let callback: any;
  const app = { post: (_route: string, fn: any) => { callback = fn; } };
  const register = new Function("app", "sdk", "BACKUP_HEARTBEAT_TASK_UID", "reconcileStaleBackupRuns", "advanceBackupRunBatch", "MAX_HEARTBEAT_BACKUP_STEPS", "checkAndNotifyBackupHealth", "BACKUP_PROTOCOL_VERSION", "console", route);
  register(app, { authenticateRequest }, "ivEbr4395zxWx2ah9n3CkD", reconcile, advance, 8, health, 2, { error: vi.fn() });
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return { callback, reconcile, advance, health, response };
}

describe("recibo e autorização do endpoint de backup", () => {
  it("não avança nem envia aviso quando a autenticação falha", async () => {
    const f = handler(vi.fn(async () => { throw new Error("Sessão ausente"); }));
    await f.callback({}, f.response);
    expect(f.reconcile).not.toHaveBeenCalled();
    expect(f.advance).not.toHaveBeenCalled();
    expect(f.health).not.toHaveBeenCalled();
    expect(f.response.status).toHaveBeenCalledWith(500);
  });
  it("recusa outra tarefa e expõe versão/etapas no recibo autorizado", async () => {
    const denied = handler(vi.fn(async () => ({ isCron: true, taskUid: "outra-tarefa" })));
    await denied.callback({}, denied.response);
    expect(denied.response.status).toHaveBeenCalledWith(403);
    expect(denied.health).not.toHaveBeenCalled();
    expect(denied.advance).not.toHaveBeenCalled();
    const accepted = handler(vi.fn(async () => ({ isCron: true, taskUid: "ivEbr4395zxWx2ah9n3CkD" })));
    await accepted.callback({}, accepted.response);
    expect(accepted.advance).toHaveBeenCalledWith("heartbeat", 8);
    expect(accepted.health).toHaveBeenCalledTimes(1);
    expect(accepted.response.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, protocolVersion: 2, stepsProcessed: 8 }));
  });
});
