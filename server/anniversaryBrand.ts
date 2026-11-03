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
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#143640;color:#f4f5f1;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{box-sizing:border-box;width:min(100% - 32px,520px);padding:32px 24px;text-align:center}.brand-lockup{display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap}.logo-plaque{display:grid;place-items:center;width:110px;height:110px;border-radius:14px;background:#fff;box-shadow:0 12px 32px #071d2480}.logo-plaque img{display:block;width:88px;height:88px;object-fit:contain}.anniversary-mark{display:flex;align-items:baseline;gap:8px;color:#d4af37;line-height:1}.anniversary-number{font-size:72px;font-weight:800;letter-spacing:-.08em}.anniversary-word{font-size:25px;font-weight:750;letter-spacing:.08em}.divider{width:min(100%,360px);height:1px;margin:24px auto;background:#d4af37aa}.eyebrow{margin:0 0 10px;color:#e4c96a;font-size:12px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}h1{margin:0;font-size:clamp(24px,5vw,34px);line-height:1.15;letter-spacing:-.02em}p{line-height:1.6;color:#d5e1df}.supporting{margin:18px auto 8px;font-size:16px}.period{margin:0;color:#e4c96a;font-size:13px;font-weight:650}.welcome{margin:26px 0 0;color:#d5e1df;font-size:14px}@media(max-width:380px){main{padding-inline:16px}.brand-lockup{gap:12px}.logo-plaque{width:94px;height:94px}.logo-plaque img{width:76px;height:76px}.anniversary-number{font-size:58px}.anniversary-word{font-size:21px}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style></head><body><main><div class="brand-lockup"><div class="logo-plaque"><img src="/logo-abrwf.png" alt="ABRWF"></div>${anniversary ? `<div class="anniversary-mark" aria-label="${badge}"><span class="anniversary-number">1</span><span class="anniversary-word">ANO</span></div>` : ""}</div><div class="divider"></div>${anniversary ? `<p class="eyebrow">${eyebrow}</p><h1>${headline}</h1><p class="supporting">${supporting}</p><p class="period">${period}</p>` : `<h1>Bem-vindo ao ABRWF</h1>`}<p class="welcome">Confirmando seu acesso individual...</p></main><script>setTimeout(function(){location.replace('/')},1200)</script></body></html>`;
}
