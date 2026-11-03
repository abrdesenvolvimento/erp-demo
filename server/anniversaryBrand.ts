import { ANNIVERSARY_BRAND } from "../shared/anniversaryBrand";

type AnniversaryCopy = typeof ANNIVERSARY_BRAND;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

export function renderOAuthSuccessPage(
  anniversary: boolean,
  copy: AnniversaryCopy = ANNIVERSARY_BRAND,
): string {
  const badge = escapeHtml(copy.badge);
  const eyebrow = escapeHtml(copy.eyebrow);
  const headline = escapeHtml(copy.headline);
  const supporting = escapeHtml(copy.supporting);
  const period = escapeHtml(copy.period);

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entrando no ABRWF</title><meta http-equiv="refresh" content="2;url=/"><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#114352,#2f6d44);color:#f4f5f1;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{box-sizing:border-box;width:min(100% - 32px,520px);padding:32px 24px;text-align:center}.brand-lockup{display:flex;align-items:center;justify-content:center;flex-wrap:wrap}.anniversary-seal{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:18px;width:min(100%,420px);min-height:142px;padding:20px 24px;border-radius:24px;background:linear-gradient(135deg,#fbfaf2,#eff3e4);box-shadow:0 12px 32px #071d2480}.logo-plaque{display:grid;place-items:center;flex:0 0 auto}.logo-plaque img{display:block;width:110px;height:110px;object-fit:contain;mix-blend-mode:multiply}.anniversary-mark{display:flex;align-items:baseline;gap:8px;line-height:1}.anniversary-number{color:#d59e15;font-size:72px;font-weight:800;letter-spacing:-.08em}.anniversary-word{color:#2f6d44;font-size:25px;font-weight:750;letter-spacing:.08em}.divider{width:min(100%,360px);height:1px;margin:24px auto;background:#d59e15aa}.eyebrow{margin:0 0 10px;color:#fbfaf2;font-size:12px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}h1{margin:0;font-size:clamp(24px,5vw,34px);line-height:1.15;letter-spacing:-.02em}p{line-height:1.6;color:#eff3e4}.supporting{margin:18px auto 8px;font-size:16px}.period{margin:0;color:#fbfaf2;font-size:13px;font-weight:650}.welcome{margin:26px 0 0;color:#eff3e4;font-size:14px}@media(max-width:380px){main{padding-inline:16px}.anniversary-seal{gap:10px;padding-inline:14px}.logo-plaque img{width:82px;height:82px}.anniversary-number{font-size:58px}.anniversary-word{font-size:21px}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  </style></head><body><main><div class="brand-lockup">${anniversary ? `<div class="anniversary-seal"><div class="logo-plaque"><img src="/logo-abrwf.png" alt="ABRWF"></div><div class="anniversary-mark" aria-label="${badge}"><span class="anniversary-number">1</span><span class="anniversary-word">ANO</span></div></div>` : `<div class="logo-plaque"><img src="/logo-abrwf.png" alt="ABRWF"></div>`}</div>${anniversary ? `<div class="divider"></div><p class="eyebrow">${eyebrow}</p><h1>${headline}</h1><p class="supporting">${supporting}</p><p class="period">${period}</p>` : `<h1>Bem-vindo ao ABRWF</h1>`}<p class="welcome">Confirmando seu acesso individual...</p></main><script>setTimeout(function(){location.replace('/')},1200)</script></body></html>`;
}
