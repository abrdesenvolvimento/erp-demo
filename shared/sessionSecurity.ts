export const SECURITY_TIME_ZONE = "America/Sao_Paulo";
export const DAILY_LOGIN_HOUR = 4;
export const DEFAULT_IDLE_MINUTES = 5;
export const ALLOWED_IDLE_MINUTES = [1, 3, 5, 10, 15, 30] as const;
export type OperatorSessionState = "SIGNED_OUT" | "LOGIN_REQUIRED" | "PIN_SETUP_REQUIRED" | "PIN_CONFIRM_REQUIRED" | "LOCKED" | "ACTIVE";
export type OperatorSessionStatus = {
  state: OperatorSessionState;
  user: { id: string; name: string | null; avatarUrl: string | null } | null;
  company: { id: number; name: string; logoUrl: string | null } | null;
  idleMinutes: number;
  serverNow: number;
  lastActivityAt: number | null;
  expiresAt: number | null;
  retryAfterSeconds: number;
  hasPin: boolean;
  sessionRef?: string | null;
  productionTerminal?: { companyId: number; name: string } | null;
};

/** O próximo corte das 04h de Brasília (UTC-3), independente do fuso do servidor. */
export function nextDailyLoginCutoff(now: number): number {
  const brazil = new Date(now - 3 * 60 * 60 * 1000);
  const cutoff = Date.UTC(brazil.getUTCFullYear(), brazil.getUTCMonth(), brazil.getUTCDate(), DAILY_LOGIN_HOUR + 3);
  return now < cutoff ? cutoff : cutoff + 24 * 60 * 60 * 1000;
}

export function isAnniversaryMonth(now: number): boolean {
  const date = new Date(now - 3 * 60 * 60 * 1000);
  return date.getUTCFullYear() === 2026 && date.getUTCMonth() === 10;
}
