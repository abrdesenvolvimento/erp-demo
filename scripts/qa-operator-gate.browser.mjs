// QA somente no navegador sandbox: intercepta TODAS as chamadas tRPC e ao Print Agent.
// Não autentica usuário real, não chama mutations no servidor e não altera dados do ERP.
export async function runOperatorGateQA() {
  const originalFetch = window.fetch;
  const originalPath = location.pathname;
  const originals = { company: document.cookie.match(/(?:^| )activeCompanyId=([^;]+)/)?.[1], branch: document.cookie.match(/(?:^| )activeBranchId=([^;]+)/)?.[1] };
  const now = Date.now();
  const cutoff = (() => { const b = new Date(now - 10800000); const c = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate(), 7); return now < c ? c : c + 86400000; })();
  const user = { id: 'qa-operador-sintetico', name: 'Operador QA', role: 'admin', email: 'qa@example.invalid', blocked: false, avatarUrl: null };
  let state = 'PIN_CONFIRM_REQUIRED';
  let printCount = 0;
  const calls = [];
  const item = { id: 987654321, orderId: 987654321, tableNumber: 7, waiterName: 'QA', customerLabel: 'Teste sem dados reais', productName: 'Item fictício QA', quantity: 1, notes: 'Teste de preservação', productionDestination: 'KITCHEN', status: 'PENDING', sentAt: new Date(now).toISOString(), createdAt: new Date(now).toISOString() };
  let items = [item];
  function value(path) {
    calls.push(path);
    if (path === 'operatorSecurity.status') return { state, user, company: { id: 2, name: 'A Brasa Reúne', logoUrl: null }, idleMinutes: 5, serverNow: Date.now(), lastActivityAt: Date.now(), expiresAt: cutoff, retryAfterSeconds: 0, hasPin: true, sessionRef: 'qa-public-ref', productionTerminal: { companyId: 2, name: 'QA somente navegador' } };
    if (path === 'auth.me') return state === 'ACTIVE' ? user : null;
    if (path === 'operatorSecurity.unlock') { state = 'ACTIVE'; return { success: true, retryAfterSeconds: 0 }; }
    if (path === 'operatorSecurity.lock') { state = 'LOCKED'; return { success: true }; }
    if (path === 'operatorSecurity.activity') return { success: true };
    if (path === 'auth.logout') { state = 'LOGIN_REQUIRED'; return { success: true }; }
    if (path === 'company.myCompanies') return [{ companyId: 2, branchId: 2, role: 'admin', isDefault: true, companyName: 'A Brasa Reúne', companyLegalName: 'A Brasa Reúne', companyLogoUrl: null, branchName: 'QA' }];
    if (path === 'company.setActive') return { success: true };
    if (path === 'salon.getKDSItems') return items;
    if (path === 'salon.getKDSStats') return { todayOrders: 1, todayItems: 1, avgPrepTimeMin: 0, lastOrderTime: null, itemStats: [] };
    return [];
  }
  window.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input), location.origin);
    if (url.pathname.startsWith('/api/trpc/')) {
      const paths = decodeURIComponent(url.pathname.split('/api/trpc/')[1]).split(',');
      const result = paths.map(path => ({ result: { data: { json: value(path) } } }));
      return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.hostname === '127.0.0.1' && url.port === '9111') {
      if (url.pathname.includes('print')) printCount++;
      return new Response(JSON.stringify({ status: 'online', success: true, printers: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname.startsWith('/api/')) return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    return originalFetch.call(window, input, init);
  };
  const signal = type => window.dispatchEvent(new CustomEvent('abrwf:operator-security', { detail: { type, nonce: crypto.randomUUID() } }));
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function wait(check, message, timeout = 10000) { const start = Date.now(); while (!check()) { if (Date.now() - start > timeout) throw new Error(message); await pause(100); } }
  const results = [];
  try {
    document.cookie = 'activeCompanyId=;path=/;max-age=0'; document.cookie = 'activeBranchId=;path=/;max-age=0';
    history.pushState({}, '', '/salao/kds-cozinha'); window.dispatchEvent(new PopStateEvent('popstate')); signal('status');
    await wait(() => document.querySelector('input[name="operator-pin"]'), 'PIN inicial não apareceu');
    await wait(() => calls.includes('salon.getKDSItems'), 'KDS pareado sem empresa não consultou produção');
    await wait(() => printCount > 0, 'KDS pareado não enviou o ticket fictício');
    results.push('KDS pareado sem cookie de empresa consultou produção durante PIN obrigatório.');
    const input = document.querySelector('input[name="operator-pin"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '582947'); input.dispatchEvent(new Event('input', { bubbles: true }));
    input.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await wait(() => !document.querySelector('.operator-access'), 'PIN confirmado não liberou a operação / auth.me ficou em null');
    await wait(() => [...document.querySelectorAll('h1')].some(el => el.textContent.includes('KDS Cozinha')), 'KDS não hidratou após PIN');
    results.push('PIN confirmou e hidratou auth.me/empresa, sem ficar preso ao login legado.');
    const before = printCount;
    // DashboardLayout pode trocar o conteúdo visual por loading sem desmontar o componente
    // SalaoKDSCozinha, que é quem mantém as refs de impressão. Observar o wrapper persistente.
    const kds = document.querySelector('.min-h-screen.bg-gradient-to-br.from-gray-950')?.closest('div[aria-hidden="false"]');
    if (!kds) throw new Error('Elemento KDS não encontrado');
    kds.dataset.qaPreserved = 'yes';
    state = 'LOCKED'; signal('lock'); signal('status');
    await wait(() => document.querySelector('.operator-access'), 'Bloqueio não ocultou a operação');
    const path = location.pathname;
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    await pause(100);
    if (location.pathname !== path) throw new Error('Atalho escapou do bloqueio');
    state = 'ACTIVE'; signal('status');
    await wait(() => !document.querySelector('.operator-access'), 'Desbloqueio não restabeleceu a tela');
    const preserved = document.querySelector('[data-qa-preserved="yes"]');
    if (preserved !== kds) throw new Error(`Wrapper KDS desmontou; tickets antes=${before}, agora=${printCount}`);
    await pause(800);
    if (printCount !== before) throw new Error('Bloqueio/desbloqueio reimprimiu item recente');
    results.push('KDS preservou montagem e não reimprimiu; atalhos não contornaram bloqueio.');
    return { success: true, results, mockedRequests: calls.length, printsIntercepted: printCount };
  } finally {
    window.fetch = originalFetch;
    if (originals.company) document.cookie = `activeCompanyId=${originals.company};path=/`; else document.cookie = 'activeCompanyId=;path=/;max-age=0';
    if (originals.branch) document.cookie = `activeBranchId=${originals.branch};path=/`; else document.cookie = 'activeBranchId=;path=/;max-age=0';
    history.replaceState({}, '', originalPath); window.dispatchEvent(new PopStateEvent('popstate'));
    signal('logout');
  }
}
