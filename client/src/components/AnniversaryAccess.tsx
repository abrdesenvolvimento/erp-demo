import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { isAnniversaryMonth } from "../../../shared/sessionSecurity";

type AccessCompany = { id: number; name: string; logoUrl: string | null } | null;
export type AnniversaryAccessProps = {
  children: ReactNode;
  serverNow?: number;
  company?: AccessCompany;
};

/** Clock independent from the login date; no anniversary before server time arrives. */
function useAnniversaryClock(serverNow?: number) {
  const [clock, setClock] = useState<{ now: number; offset: number } | null>(null);
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

export function AnniversaryAccess({ children, serverNow, company = null }: AnniversaryAccessProps) {
  const anniversary = useAnniversaryClock(serverNow);
  const brasa = company?.id === 2 || /brasa/i.test(company?.name ?? "");
  const variables = {
    "--access-accent": brasa ? "#F07A00" : "#E4BC69",
    "--access-company": brasa ? "#2F2F2F" : "#49682D",
  } as CSSProperties;
  return (
    <main className="operator-access" style={variables}>
      <style>{`
        .operator-access{position:fixed;inset:0;z-index:99990;overflow:auto;background:#081f23;color:#eef3ed;font-family:inherit;display:flex;min-height:100dvh;isolation:isolate}
        .operator-access *{box-sizing:border-box}
        .operator-access-grid{width:min(1280px,100%);margin:auto;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(350px,1fr);gap:clamp(36px,6vw,96px);padding:clamp(24px,5vw,72px);align-items:center}
        .operator-access-brand{display:flex;align-items:center;gap:18px;margin-bottom:clamp(32px,5vh,60px)}
        .operator-access-logo{width:76px;height:76px;object-fit:contain;background:#fff;border-radius:18px;padding:8px}
        .operator-access-eyebrow{text-transform:uppercase;letter-spacing:.19em;font-size:11px;font-weight:600;color:#bccac5}
        .operator-access-heading{font-size:clamp(34px,4.3vw,64px);line-height:1.07;letter-spacing:-.045em;font-weight:600;max-width:630px;margin:18px 0 24px}
        .operator-access-gold{color:var(--access-accent)}
        .operator-access-copy{font-size:clamp(16px,1.6vw,19px);line-height:1.65;color:#c0ceca;max-width:440px}
        .operator-access-year{margin-top:32px;display:flex;align-items:center;gap:12px;font-size:12px;letter-spacing:.035em;color:#cbb98d}
        .operator-access-line{width:40px;height:1px;background:var(--access-accent)}
        .operator-access-bottom{margin-top:52px;display:flex;align-items:center;gap:16px;color:#aabeb7;font-size:12px}
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
        .operator-access-editorial{animation:operator-access-enter 220ms ease-out both}
        @keyframes operator-access-enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:760px){.operator-access-grid{grid-template-columns:1fr;gap:28px;padding:24px 20px}.operator-access-brand{margin-bottom:24px}.operator-access-logo{width:56px;height:56px}.operator-access-heading{font-size:36px;max-width:500px;margin-bottom:16px}.operator-access-bottom{display:none}.operator-access-year{margin-top:20px}.operator-access-card{padding:24px}}
        @media(prefers-reduced-motion:reduce){.operator-access *{animation:none!important;transition:none!important;transform:none!important}}
      `}</style>
      <div className="operator-access-grid">
        <section className="operator-access-editorial" aria-label="ABRWF">
          <div className="operator-access-brand">
            <img className="operator-access-logo" src="/logo-abrwf.png" alt="ABRWF" />
            <div><div className="operator-access-eyebrow">Gestão que evolui com você</div><p className="mt-2 text-sm">Adega Beira Rio · A Brasa Reúne</p></div>
          </div>
          <div className="operator-access-eyebrow operator-access-gold">{anniversary ? "Novembro · Edição de aniversário" : "Seu próximo turno começa aqui"}</div>
          <h1 className="operator-access-heading">{anniversary ? <>ABRWF — <span className="operator-access-gold">1 ano de evolução</span></> : <>Rotina organizada.<br /><span className="operator-access-gold">Decisões melhores.</span></>}</h1>
          <p className="operator-access-copy">{anniversary ? "Um ano transformando rotina em controle e dados em decisões." : "Controle, clareza e segurança para cuidar de cada etapa da operação."}</p>
          {anniversary && <p className="operator-access-year"><span className="operator-access-line" />Novembro de 2025 — Novembro de 2026</p>}
          <div className="operator-access-bottom"><ShieldCheck size={18} /><span>Identificação individual. Operação protegida.</span><ArrowUpRight size={16} className="ml-auto" /></div>
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
