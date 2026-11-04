import React, { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { isAnniversaryMonth } from "../../../shared/sessionSecurity";
import { ANNIVERSARY_BRAND, ABRWF_ACCESS_PALETTE } from "../../../shared/anniversaryBrand";

type AccessCompany = { id: number; name: string; logoUrl: string | null } | null;
export type AnniversaryAccessProps = {
  children: ReactNode;
  serverNow?: number;
  company?: AccessCompany;
};

/** Only a visual timestamp; it never grants access or restores any operator. */
function initialAccessClock(serverNow?: number) {
  let now = serverNow;
  if (now == null && typeof document !== "undefined") {
    const value = document.getElementById("root")?.getAttribute("data-abrwf-server-now");
    if (value && /^\d{13}$/.test(value)) now = Number(value);
  }
  return now != null && Number.isFinite(now)
    ? { now, offset: now - Date.now() } : null;
}

/** The HTML and React share the server clock, avoiding a branding swap at boot. */
function useAnniversaryClock(serverNow?: number) {
  const [clock, setClock] = useState<{ now: number; offset: number } | null>(() => initialAccessClock(serverNow));
  useEffect(() => {
    if (serverNow == null || !Number.isFinite(serverNow)) return;
    const offset = serverNow - Date.now();
    setClock({ now: serverNow, offset });
  }, [serverNow]);
  useEffect(() => {
    if (!clock) return;
    const tick = () => setClock(previous => previous
      ? { ...previous, now: Date.now() + previous.offset } : null);
    const nextMinute = 60_000 - (clock.now % 60_000);
    let interval: ReturnType<typeof setInterval> | undefined;
    const timer = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60_000);
    }, nextMinute);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearTimeout(timer);
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [clock?.offset]);
  return clock != null && isAnniversaryMonth(clock.now);
}

export function AnniversarySignature() {
  return <div className="operator-access-signature" aria-label={`ABRWF — ${ANNIVERSARY_BRAND.badge}`}>
    <div className="operator-access-signature-logo"><img src="/logo-abrwf.png" alt="ABRWF" /></div>
    <div className="operator-access-signature-mark" aria-hidden="true">
      <span className="operator-access-signature-number">1</span>
      <div className="operator-access-signature-word"><span>ANO</span><span className="operator-access-signature-note">Gestão em<br />evolução</span></div>
    </div>
  </div>;
}

export function AnniversaryMessage() {
  return <>
    <AnniversarySignature />
    <h1 className="operator-access-heading operator-access-anniversary-heading">{ANNIVERSARY_BRAND.headline}</h1>
  </>;
}

/** Static presentation only: authentication still waits for the protected gate. */
export function AccessPendingCard({ boot = false }: { boot?: boolean }) {
  return <div>
    <div style={{ marginBottom: 16, display: "flex", width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, background: "#e7eee5", color: "#285847" }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" />
      </svg>
    </div>
    <h2 id={boot ? "abrwf-boot-title" : undefined} style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.25, letterSpacing: "-.025em", margin: 0 }}>Acesse o ABRWF</h2>
    <p id={boot ? "abrwf-boot-copy" : undefined} style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.625, color: "#597068" }}>Faça login para continuar.</p>
    <button id={boot ? "abrwf-boot-enter" : undefined} type="button" className="operator-access-primary" style={{ marginTop: 24 }} disabled aria-busy="true" aria-label="Entrar — validação de acesso em andamento">
      Entrar<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-7-7 7 7-7 7" /></svg>
    </button>
  </div>;
}

export function AnniversaryAccess({ children, serverNow, company = null }: AnniversaryAccessProps) {
  const anniversary = useAnniversaryClock(serverNow);
  const brasa = company?.id === 2 || /brasa/i.test(company?.name ?? "");
  const variables = {
    "--access-accent": brasa ? "#F07A00" : "#f0cd78",
    "--access-company": brasa ? "#2F2F2F" : "#49682D",
    "--access-brand-petroleum": ABRWF_ACCESS_PALETTE.petroleum,
    "--access-brand-green": ABRWF_ACCESS_PALETTE.green,
    "--access-brand-gold": ABRWF_ACCESS_PALETTE.gold,
  } as CSSProperties;
  return (
    <main className="operator-access" style={variables}>
      <style>{`
        .operator-access{position:fixed;inset:0;z-index:99990;overflow:auto;background:radial-gradient(ellipse at 90% 10%,#2f6d4499,transparent 66%),linear-gradient(118deg,var(--access-brand-petroleum) 18%,#1c5c53 60%,var(--access-brand-green));color:#f5f6ee;font-family:inherit;display:flex;min-height:100dvh;isolation:isolate}
        .operator-access *{box-sizing:border-box}
        .operator-access-grid{width:min(1280px,100%);margin:auto;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(350px,1fr);gap:clamp(36px,6vw,96px);padding:clamp(24px,5vw,72px);align-items:center}
        .operator-access-brand{display:flex;align-items:center;gap:18px;margin-bottom:clamp(32px,5vh,60px)}
        .operator-access-logo{width:76px;height:76px;object-fit:contain;background:#fff;border-radius:18px;padding:8px}
        .operator-access-eyebrow{text-transform:uppercase;letter-spacing:.19em;font-size:11px;font-weight:600;color:#bccac5}
        .operator-access-heading{font-size:clamp(34px,4.3vw,64px);line-height:1.07;letter-spacing:-.045em;font-weight:600;max-width:630px;margin:18px 0 24px}
        .operator-access-anniversary-heading{font-size:clamp(34px,3.6vw,48px);line-height:1.16;margin:28px 0 18px;max-width:560px;text-wrap:balance}
        .operator-access-signature{display:inline-flex;align-items:center;gap:18px;max-width:100%;padding:18px 26px 20px;background:linear-gradient(130deg,#fbfaf2,#eff3e4);border:1px solid #ded4aa;border-bottom:3px solid var(--access-brand-gold);border-radius:26px;box-shadow:0 18px 46px #0a283d40}
        .operator-access-signature-logo{width:148px;height:148px;overflow:hidden;flex-shrink:0}
        .operator-access-signature-logo img{width:100%;height:100%;object-fit:contain;transform:scale(1.25);mix-blend-mode:multiply}
        .operator-access-signature-mark{display:flex;align-items:center;gap:12px;color:var(--access-brand-gold);min-width:0}
        .operator-access-signature-number{font-size:136px;line-height:.95;letter-spacing:-.065em;font-weight:500;font-variant-numeric:lining-nums}
        .operator-access-signature-word{display:flex;flex-direction:column;gap:10px;font-size:32px;line-height:1;font-weight:600;letter-spacing:.075em;color:var(--access-brand-green)}
        .operator-access-signature-note{font-size:10px;line-height:1.6;letter-spacing:.14em;text-transform:uppercase;color:var(--access-brand-petroleum);font-weight:500}
        .operator-access-gold{color:var(--access-accent)}
        .operator-access-copy{font-size:clamp(16px,1.6vw,19px);line-height:1.65;color:#e0ece3;max-width:440px}
        .operator-access-card{background:#f9faf6;color:#153332;border:1px solid #d8e2d8;border-top:4px solid var(--access-accent);border-radius:24px;padding:clamp(24px,3vw,40px);box-shadow:0 24px 80px #0005;min-width:0}
        .operator-access-company{display:flex;align-items:center;gap:10px;border-radius:12px;padding:11px 13px;background:var(--access-company);color:#fff;margin-bottom:28px;font-size:13px}
        .operator-access-company img{height:32px;width:32px;object-fit:contain;border-radius:6px;background:#fff}
        .operator-access input[type=password]{background:#fff;border:1px solid #b8c9bf;border-radius:10px;color:#143331;min-height:50px;width:100%;padding:10px 14px;font-size:23px;letter-spacing:.35em}
        .operator-access input[type=password]:focus{outline:3px solid #93b5a8;outline-offset:2px}
        .operator-access input[type=checkbox]{accent-color:#17564d;width:17px;height:17px;flex:none;margin-top:3px}
        .operator-access button{min-height:42px;transition:opacity 160ms ease,transform 160ms ease;cursor:pointer}
        .operator-access button:disabled{cursor:not-allowed;opacity:.55}
        .operator-access-primary{background:#154c44;color:#fff;border-radius:11px;padding:12px 18px;font-size:14px;font-weight:600;width:100%;display:flex;align-items:center;justify-content:center;gap:10px}
        .operator-access-primary:hover:not(:disabled){transform:translateY(-1px)}
        .operator-access-secondary{color:#345c51;font-size:13px;text-decoration:underline;text-underline-offset:4px;background:transparent;padding:5px 2px}
        .operator-access-message{color:#9c312c;background:#fff0ed;border:1px solid #ebc6be;border-radius:10px;padding:12px;font-size:13px;line-height:1.5}
        .operator-access button:focus-visible{outline:3px solid #93b5a8;outline-offset:3px}
        @media(max-width:760px){.operator-access-grid{grid-template-columns:1fr;gap:28px;padding:24px 20px}.operator-access-brand{margin-bottom:24px}.operator-access-logo{width:56px;height:56px}.operator-access-heading{font-size:36px;max-width:500px;margin-bottom:16px}.operator-access-anniversary-heading{font-size:30px;margin-top:24px;line-height:1.2}.operator-access-signature{gap:12px;padding:14px 18px 16px;border-radius:22px}.operator-access-signature-logo{width:108px;height:108px}.operator-access-signature-mark{gap:10px}.operator-access-signature-number{font-size:100px}.operator-access-signature-word{font-size:26px;gap:8px}.operator-access-signature-note{font-size:9px;letter-spacing:.1em}.operator-access-card{padding:24px}}
        @media(max-width:360px){.operator-access-signature{padding:12px 14px 14px;gap:8px}.operator-access-signature-logo{width:96px;height:96px}.operator-access-signature-number{font-size:88px}.operator-access-signature-word{font-size:22px}.operator-access-signature-mark{gap:8px}}
        @media(prefers-reduced-motion:reduce){.operator-access *{animation:none!important;transition:none!important;transform:none!important}}
      `}</style>
      <div className="operator-access-grid">
        <section className="operator-access-editorial" aria-label="ABRWF">
          {anniversary ? <AnniversaryMessage /> : <>
            <div className="operator-access-brand">
              <img className="operator-access-logo" src="/logo-abrwf.png" alt="ABRWF" />
              <div><div className="operator-access-eyebrow">Gestão que evolui com você</div><p className="mt-2 text-sm">Adega Beira Rio · A Brasa Reúne</p></div>
            </div>
            <div className="operator-access-eyebrow operator-access-gold">Seu próximo turno começa aqui</div>
            <h1 className="operator-access-heading">Rotina organizada.<br /><span className="operator-access-gold">Decisões melhores.</span></h1>
            <p className="operator-access-copy">Controle, clareza e segurança para cuidar de cada etapa da operação.</p>
          </>}
        </section>
        <section className="operator-access-card" aria-label="Acesso do operador">
          {company && <div className="operator-access-company">{company.logoUrl && <img src={company.logoUrl} alt="" />}<span>{company.name}</span></div>}
          {children}
        </section>
      </div>
    </main>
  );
}

export default AnniversaryAccess;
