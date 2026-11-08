import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ execute: vi.fn(), notifyOwner: vi.fn() }));
vi.mock("./db", () => ({ getDb: async () => ({ execute: mocks.execute }) }));
vi.mock("./_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));
import { assessBackupHealth, checkAndNotifyBackupHealth } from "./backupHealth";

beforeEach(() => { vi.clearAllMocks(); });

describe("saúde do backup — avaliação sem efeitos", () => {
  const now = new Date("2026-11-08T18:00:00Z");
  it("considera recente apenas um ciclo elegível concluído abaixo do limite", () => {
    expect(assessBackupHealth("2026-11-07 08:00:00", now)).toEqual({ level: "OK", reason: "RECENT_COMPLETE", ageHours: 34 });
    expect(assessBackupHealth(new Date("2026-11-07T08:00:00Z"), now).level).toBe("OK");
  });
  it("sinaliza ausência, data inválida/futura e cópia com 36 horas", () => {
    expect(assessBackupHealth(null, now).reason).toBe("NO_COMPLETE");
    expect(assessBackupHealth("inválida", now).level).toBe("WARNING");
    expect(assessBackupHealth("2026-11-09T00:00:00Z", now).reason).toBe("NO_COMPLETE");
    expect(assessBackupHealth("2026-11-07T06:00:00Z", now).reason).toBe("STALE_COMPLETE");
  });
});

describe("saúde do backup — deduplicação de avisos simulada", () => {
  it("não grava nem avisa quando há cópia recente", async () => {
    mocks.execute.mockResolvedValueOnce([[{ updatedAt: new Date() }], []]);
    expect((await checkAndNotifyBackupHealth()).notification).toBe("NOT_NEEDED");
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });
  it("apenas um vencedor da chave diária envia aviso", async () => {
    mocks.execute.mockResolvedValueOnce([[], []]).mockResolvedValueOnce([{ affectedRows: 1 }, []]).mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mocks.notifyOwner.mockResolvedValue(true);
    expect((await checkAndNotifyBackupHealth()).notification).toBe("SENT");
    expect(mocks.notifyOwner).toHaveBeenCalledTimes(1);
    mocks.execute.mockResolvedValueOnce([[], []]).mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    expect((await checkAndNotifyBackupHealth()).notification).toBe("ALREADY_RECORDED");
    expect(mocks.notifyOwner).toHaveBeenCalledTimes(1);
  });
  it("registra recusa de envio sem declarar sucesso", async () => {
    mocks.execute.mockResolvedValueOnce([[], []]).mockResolvedValueOnce([{ affectedRows: 1 }, []]).mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mocks.notifyOwner.mockResolvedValue(false);
    expect((await checkAndNotifyBackupHealth()).notification).toBe("FAILED");
  });
});
