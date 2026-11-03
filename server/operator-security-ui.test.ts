import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnniversaryAccess, AnniversarySignature } from "../client/src/components/AnniversaryAccess";
import { ANNIVERSARY_BRAND } from "../shared/anniversaryBrand";
import {
  effectiveOperatorState,
  isOperatorSignal,
  isOperatorStatusQuery,
  isTrustedOperatorActivity,
  isValidOperatorPin,
  operatorDeadline,
  operatorIdentitySignature,
  OPERATOR_ACTIVITY_THROTTLE_MS,
  remainingCooldownSeconds,
} from "../client/src/hooks/operatorSecurityRuntime";
import { isAnniversaryMonth, type OperatorSessionStatus } from "../shared/sessionSecurity";

const now = Date.parse("2026-11-15T12:00:00-03:00");
function session(overrides: Partial<OperatorSessionStatus> = {}): OperatorSessionStatus {
  return { state: "ACTIVE", user: { id: "operator-a", name: "Operador A", avatarUrl: null }, company: null,
    idleMinutes: 5, serverNow: now, lastActivityAt: now, expiresAt: Date.parse("2026-11-16T04:00:00-03:00"), retryAfterSeconds: 0, hasPin: true, ...overrides };
}

describe("Operator UI runtime — executable security behavior", () => {
  it("blocks precisely at the idle deadline before the next status poll", () => {
    const status = session();
    expect(operatorDeadline(status)).toBe(now + 5 * 60_000);
    expect(effectiveOperatorState(status, now + 5 * 60_000 - 1)).toBe("ACTIVE");
    expect(effectiveOperatorState(status, now + 5 * 60_000)).toBe("LOCKED");
  });
  it("requires complete login at 04h even with recent activity", () => {
    const serverNow = Date.parse("2026-11-16T03:59:50-03:00");
    const status = session({ serverNow, lastActivityAt: serverNow });
    expect(effectiveOperatorState(status, Date.parse("2026-11-16T04:00:00-03:00"))).toBe("LOGIN_REQUIRED");
  });
  it("uses the daily cutoff when server expiry is missing or too late", () => {
    const serverNow = Date.parse("2026-11-16T03:59:50-03:00");
    const atCutoff = Date.parse("2026-11-16T04:00:00-03:00");
    for (const expiresAt of [null, atCutoff + 86_400_000]) {
      const status = session({ serverNow, lastActivityAt: serverNow, expiresAt });
      expect(operatorDeadline(status)).toBe(atCutoff);
      expect(effectiveOperatorState(status, atCutoff)).toBe("LOGIN_REQUIRED");
    }
  });
  it("respects earlier server expiry and missing last activity", () => {
    expect(effectiveOperatorState(session({ expiresAt: now + 1000 }), now + 1000)).toBe("LOGIN_REQUIRED");
    expect(effectiveOperatorState(session({ lastActivityAt: null }), now)).toBe("LOCKED");
  });
  it("never locally revives any inactive server state", () => {
    for (const state of ["LOCKED", "LOGIN_REQUIRED", "PIN_SETUP_REQUIRED", "PIN_CONFIRM_REQUIRED", "SIGNED_OUT"] as const) {
      expect(effectiveOperatorState(session({ state }), now - 60_000)).toBe(state);
      expect(effectiveOperatorState(session({ state }), now + 86_400_000)).toBe(state);
    }
  });
  it("accepts only trusted discrete interaction, not timer/movement/synthetic input", () => {
    for (const type of ["pointerdown", "keydown", "touchstart"]) {
      expect(isTrustedOperatorActivity({ type, isTrusted: true })).toBe(true);
      expect(isTrustedOperatorActivity({ type, isTrusted: false })).toBe(false);
    }
    for (const type of ["mousemove", "pointermove", "touchmove", "scroll", "focus", "visibilitychange", "heartbeat", "poll"]) {
      expect(isTrustedOperatorActivity({ type, isTrusted: true })).toBe(false);
    }
    expect(OPERATOR_ACTIVITY_THROTTLE_MS).toBeLessThanOrEqual(20_000);
    expect(OPERATOR_ACTIVITY_THROTTLE_MS).toBeGreaterThan(0);
  });
  it("checks six ASCII digits, excluding partial/alphabetic/long secrets", () => {
    expect(isValidOperatorPin("583907")).toBe(true);
    for (const pin of ["", "12345", "1234567", "12x456", "１２３４５６", "123 45", "\n123456"]) expect(isValidOperatorPin(pin)).toBe(false);
  });
  it("separates operator identity and accepts a future non-secret session fingerprint", () => {
    expect(operatorIdentitySignature(session())).not.toBe(operatorIdentitySignature(session({ user: { id: "operator-b", name: "B", avatarUrl: null } })));
    expect(operatorIdentitySignature(session())).not.toBe(operatorIdentitySignature(session({ expiresAt: now + 2000 })));
    const sidA = { ...session(), sessionRef: "public-fingerprint-a" };
    const sidB = { ...session(), sessionRef: "public-fingerprint-b" };
    expect(operatorIdentitySignature(sidA)).not.toBe(operatorIdentitySignature(sidB));
    expect(operatorIdentitySignature(session({ user: null }))).toBe("signed-out");
  });
  it("retains only the security status query when flushing a previous operator", () => {
    expect(isOperatorStatusQuery([["operatorSecurity", "status"], { type: "query" }])).toBe(true);
    for (const key of [[["sales", "list"]], [["auth", "me"]], [["operatorSecurity", "sessions"]], [["operatorSecurity", "events"]], [["operatorSecurity", "policy"]], ["status"]]) {
      expect(isOperatorStatusQuery(key)).toBe(false);
    }
  });
  it("counts down cooldown locally, rounding up and never below zero", () => {
    expect(remainingCooldownSeconds(now + 1001, now)).toBe(2);
    expect(remainingCooldownSeconds(now + 1000, now)).toBe(1);
    expect(remainingCooldownSeconds(now, now)).toBe(0);
    expect(remainingCooldownSeconds(now - 1000, now)).toBe(0);
  });
  it("anniversary begins and disappears at São Paulo month boundaries", () => {
    expect(isAnniversaryMonth(Date.parse("2026-11-01T02:59:59.999Z"))).toBe(false);
    expect(isAnniversaryMonth(Date.parse("2026-11-01T03:00:00Z"))).toBe(true);
    expect(isAnniversaryMonth(Date.parse("2026-12-01T02:59:59.999Z"))).toBe(true);
    expect(isAnniversaryMonth(Date.parse("2026-12-01T03:00:00Z"))).toBe(false);
    expect(isAnniversaryMonth(Date.parse("2025-11-15T12:00:00-03:00"))).toBe(false);
    expect(isAnniversaryMonth(Date.parse("2027-11-15T12:00:00-03:00"))).toBe(false);
  });
});

describe("Operator UI source invariants — secondary integration guardrails", () => {
  const source = (path: string) => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
  const gate = source("client/src/components/OperatorSecurityGate.tsx");
  const access = source("client/src/components/AnniversaryAccess.tsx");
  const signals = source("client/src/hooks/useOperatorSecuritySignal.ts");
  const page = source("client/src/pages/Seguranca.tsx");
  it("exempts only exact public paths and limits hidden production children to paired KDS", () => {
    expect(gate).toContain('path === "/cardapio" || path === "/aviso-inauguracao"');
    expect(gate).toContain('path === "/salao/kds-cozinha" || path === "/salao/kds-bar"');
    expect(gate).toContain("Boolean(productionTerminal) && isProductionStationPath(path)");
    expect(gate).toContain('hidden={!active} inert={!active} aria-hidden={!active}');
    expect(gate).toContain("{productionStation ?");
    expect(gate).toContain(": active ? <>{children}</> : null}");
  });
  it("has bounded status retry and touches server without client timestamps", () => {
    expect(gate).toContain("retry: 2");
    expect(gate).toContain("refetchInterval: OPERATOR_STATUS_POLL_MS");
    expect(gate).toContain("activity.mutate(undefined");
    expect(gate).not.toMatch(/addEventListener\(["'](?:mousemove|pointermove|touchmove)["']/);
  });
  it("masks input, disables autocomplete and clears both fields before network attempts", () => {
    expect(gate).toContain('type="password" inputMode="numeric"');
    expect(gate).toContain('maxLength={6}');
    expect(gate).toContain('autoComplete="off"');
    const capture = gate.indexOf("const submittedPin = pin;");
    const request = gate.indexOf("await setup.mutateAsync", capture);
    expect(gate.slice(capture, request)).toContain('setPin("")');
    expect(gate.slice(capture, request)).toContain('setConfirmation("")');
  });
  it("awaits logout before clearing caches and beginning fresh OAuth", () => {
    expect(gate).toMatch(/await logout\(\);[\s\S]*?await queryClient.cancelQueries\(\);[\s\S]*?queryClient.clear\(\);[\s\S]*?await warmUpAndLogin\(\)/);
    expect(gate).not.toMatch(/setActiveCompany\(|document\.cookie\s*=/);
  });
  it("has storage fallback payloads without PIN, cookie or token persistence", () => {
    expect(signals).toContain("new BroadcastChannel");
    expect(signals).toContain('addEventListener("storage"');
    expect(signals).not.toContain('addEventListener("abrwf-session-logout"');
    expect(signals).toContain("{ type, nonce: crypto.randomUUID() }");
    expect(gate).not.toMatch(/(?:localStorage|sessionStorage)\.setItem/);
  });
  it("hydrates the actual operator auth before rendering business UI after PIN", () => {
    expect(gate).toContain('identityReady && authReady && state === "ACTIVE"');
    expect(gate).toMatch(/await utils.auth.me.invalidate[\s\S]*?await utils.auth.me.fetch\(\)[\s\S]*?me.id !== statusRef.current\?\.user\?\.id[\s\S]*?await utils.company.myCompanies.invalidate\(\)[\s\S]*?setAuthReadyIdentity\(signature\)/);
    expect(gate).toContain("authHydrationEpoch.current");
    expect(gate).toContain("setAuthReadyIdentity(null)");
  });
  it("offers a fresh complete login and signout even when verification fails", () => {
    expect(gate).toContain('state === "VERIFYING" && unavailable && <button');
    expect(gate).toContain("Fazer novo login completo");
    expect(gate).toContain('(state !== "VERIFYING" || unavailable)');
  });
  it("uses server-based anniversary clock, short editorial motion and reduced-motion support", () => {
    expect(access).toContain("serverNow - Date.now()");
    expect(access).toContain("setInterval(tick, 60_000)");
    expect(access).toContain("prefers-reduced-motion:reduce");
    expect(access).toContain("220ms");
    expect(access).toContain("ABRWF — ");
    expect(access).toContain("ANNIVERSARY_BRAND.period");
    expect(ANNIVERSARY_BRAND.period).toBe("Novembro de 2025 — Novembro de 2026");
  });
  it("uses shared idle choices and real production terminal APIs", () => {
    expect(page).toContain("ALLOWED_IDLE_MINUTES.map");
    expect(page).toContain("Continuidade de produção");
    expect(page).toContain("trpc.operatorSecurity.enableProductionTerminal.useMutation");
    expect(page).toContain("trpc.operatorSecurity.revokeProductionTerminal.useMutation");
    expect(page).toContain("30 dias");
    expect(page).not.toContain("tokenHash");
  });
  it("recovers only another linked operator PIN through the audited server operation", () => {
    expect(page).toContain("trpc.company.companyUsers.useQuery({ companyId }");
    expect(page).toContain("row.userId !== user?.id");
    expect(page).toContain("trpc.operatorSecurity.resetUserPin.useMutation");
    expect(page).toContain("reset.mutate({ userId: selectedUserId, reason: reason.trim() })");
    expect(page).toContain("minLength={10}");
    expect(page).toContain("revogação de todas as suas sessões");
  });
});

describe("Assinatura comemorativa renderizada", () => {
  it("integra o logo original e o selo acessível de um ano num único conjunto", () => {
    const html = renderToStaticMarkup(createElement(AnniversarySignature));
    expect(html).toContain('aria-label="ABRWF — 1 ANO"');
    expect(html).toContain('src="/logo-abrwf.png"');
    expect(html).toContain('alt="ABRWF"');
    expect(html).toContain('operator-access-signature-number">1</span>');
    expect(html).toContain('>ANO</span>');
    expect(html.match(/<img /g)).toHaveLength(1);
  });
  it("usa a frase aprovada sem duplicar a antiga chamada", () => {
    expect(ANNIVERSARY_BRAND.headline).toBe("Um ano construindo uma gestão mais inteligente.");
    expect(ANNIVERSARY_BRAND.supporting).toBe("Mais controle. Melhores decisões. Novas possibilidades.");
    const access = readFileSync(resolve(import.meta.dirname, "..", "client/src/components/AnniversaryAccess.tsx"), "utf8");
    expect(access).toContain("<AnniversarySignature />");
    expect(access).not.toContain("1 ano de evolução");
  });
  it("mantém a identidade normal e o formulário sem campanha antes da confirmação do relógio", () => {
    const html = renderToStaticMarkup(createElement(AnniversaryAccess, { children: createElement("button", null, "Entrar") }));
    expect(html).toContain("Rotina organizada.");
    expect(html).toContain("Decisões melhores.");
    expect(html).toContain(">Entrar</button>");
    expect(html).not.toContain('aria-label="ABRWF — 1 ANO"');
  });
});
