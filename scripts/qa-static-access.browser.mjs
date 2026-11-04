// QA no sandbox: a navegação acontece em iframe temporário; APIs são fictícias.
// Não autentica ninguém, não executa mutações reais e remove o frame ao terminar.
export async function runStaticAccessQA() {
  const html = await (await fetch("/")).text();
  const frame = document.createElement("iframe");
  frame.style.cssText = "width:893px;height:768px;position:fixed;left:0;top:0;z-index:999999;border:0";
  const setup = `<script>
    window.__staticQa = [];
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const raw = String(input instanceof Request ? input.url : input);
      const url = new URL(raw, document.baseURI);
      if (url.pathname.startsWith('/api/trpc/')) {
        const paths = decodeURIComponent(url.pathname.split('/api/trpc/')[1]).split(',');
        if (paths.includes('operatorSecurity.status')) await new Promise(resolve => setTimeout(resolve, 3000));
        const status = { state: 'SIGNED_OUT', user: null, company: null, sessionRef: null,
          idleMinutes: 5, serverNow: Date.now(), lastActivityAt: null, expiresAt: null,
          retryAfterSeconds: 0, hasPin: false };
        const result = paths.map(path => ({ result: { data: { json: path === 'operatorSecurity.status' ? status : null } } }));
        return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
      }
      if (url.pathname.startsWith('/api/')) return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
      return originalFetch.call(window, input, init);
    };
    window.__qaTimer = setInterval(() => {
      const card = document.querySelector('.operator-access-card');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      window.__staticQa.push({ boot: !!document.getElementById('abrwf-boot'),
        title: document.querySelector('h1')?.textContent, cardTitle: card.querySelector('h2')?.textContent,
        disabled: card.querySelector('button')?.disabled,
        loading: /Carregando o sistema|Verificando seu acesso|Aguarde um instante/.test(document.body.innerText),
        animations: document.getAnimations().length,
        rect: [rect.x, rect.y, rect.width, rect.height].map(value => Math.round(value)) });
    }, 50);
  <\/script>`;
  frame.srcdoc = html.replace("<head>", `<head><base href="${location.origin}/">`)
    .replace('<script type="module"', setup + '<script type="module"');
  document.body.append(frame);
  try {
    await new Promise(resolve => setTimeout(resolve, 4800));
    const samples = frame.contentWindow.__staticQa || [];
    clearInterval(frame.contentWindow.__qaTimer);
    const titles = [...new Set(samples.map(sample => sample.title))];
    const boot = samples.find(sample => sample.boot);
    const pending = samples.find(sample => !sample.boot && sample.disabled);
    const ready = samples.find(sample => !sample.boot && !sample.disabled && sample.cardTitle === "Acesse o ABRWF");
    const sameGeometry = boot && pending && JSON.stringify(boot.rect) === JSON.stringify(pending.rect);
    return { success: Boolean(boot && pending && ready && sameGeometry && titles.length === 1 &&
      !samples.some(sample => sample.loading || sample.animations > 0 || sample.cardTitle === 'Conexão indisponível')),
      samples: samples.length, titles, sameGeometry, boot, pending, ready };
  } finally {
    if (frame.contentWindow?.__qaTimer) clearInterval(frame.contentWindow.__qaTimer);
    frame.remove();
  }
}
