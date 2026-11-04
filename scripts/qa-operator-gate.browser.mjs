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
  let unlockCount = 0;
  let statusDelay = 0;
  const calls = [];
  const item = { id: 987654321, orderId: 987654321, tableNumber: 7, waiterName: 'QA', customerLabel: 'Teste sem dados reais', productName: 'Item fictício QA', quantity: 1, notes: 'Teste de preservação', productionDestination: 'KITCHEN', status: 'PENDING', sentAt: new Date(now).toISOString(), createdAt: new Date(now).toISOString() };
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  function snapshot() {
    return { state, user, company: { id: 2, name: 'A Brasa Reúne', logoUrl: null }, idleMinutes: 1,
      serverNow: Date.now(), lastActivityAt: Math.floor(Date.now() / 1000) * 1000, expiresAt: cutoff,
      retryAfterSeconds: 0, hasPin: true, sessionRef: 'qa-public-ref', productionTerminal: { companyId: 2, name: 'QA somente navegador' } };
  }
  async function value(path) {
    calls.push(path);
    if (path === 'operatorSecurity.status') { const result = snapshot(); if (statusDelay) await pause(statusDelay); return result; }
    if (path === 'auth.me') return state === 'ACTIVE' ? user : null;
    if (path === 'operatorSecurity.unlock') { unlockCount++; await pause(200); state = 'ACTIVE'; return { success: true, retryAfterSeconds: 0 }; }
    if (path === 'operatorSecurity.lock') { state = 'LOCKED'; return { success: true }; }
    if (path === 'operatorSecurity.activity') return { success: true, status: snapshot() };
    if (path === 'auth.logout') { state = 'LOGIN_REQUIRED'; return { success: true }; }
    if (path === 'company.myCompanies') return [{ companyId: 2, branchId: 2, role: 'admin', isDefault: true, companyName: 'A Brasa Reúne', companyLegalName: 'A Brasa Reúne', companyLogoUrl: null, branchName: 'QA' }];
    if (path === 'company.setActive') return { success: true };
    if (path === 'salon.getKDSItems') return [item];
    if (path === 'salon.getKDSStats') return { todayOrders: 1, todayItems: 1, avgPrepTimeMin: 0, lastOrderTime: null, itemStats: [] };
    return [];
  }
  window.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input), location.origin);
    if (url.pathname.startsWith('/api/trpc/')) {
      const paths = decodeURIComponent(url.pathname.split('/api/trpc/')[1]).split(',');
      const result = await Promise.all(paths.map(async path => ({ result: { data: { json: await value(path) } } })));
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
  async function wait(check, message, timeout = 10000) { const start = Date.now(); while (!check()) { if (Date.now() - start > timeout) throw new Error(message); await pause(60); } }
  async function submitPin() {
    const input = document.querySelector('input[name="operator-pin"]');
    if (!input || input.disabled) throw new Error('Campo de PIN não disponível');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '582947'); input.dispatchEvent(new Event('input', { bubbles: true }));
    input.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }
  const results = [];
  try {
    document.cookie = 'activeCompanyId=;path=/;max-age=0'; document.cookie = 'activeBranchId=;path=/;max-age=0';
    history.pushState({}, '', '/salao/kds-cozinha'); window.dispatchEvent(new PopStateEvent('popstate')); signal('status');
    await wait(() => document.querySelector('input[name="operator-pin"]'), 'PIN inicial não apareceu');
    await wait(() => calls.includes('salon.getKDSItems'), 'KDS pareado sem empresa não consultou produção');
    await wait(() => printCount > 0, 'KDS pareado não enviou o ticket fictício');
    results.push('KDS pareado sem cookie de empresa consultou produção durante PIN obrigatório.');
    statusDelay = 650;
    await submitPin();
    await pause(400);
    const pendingInput = document.querySelector('input[name="operator-pin"]');
    if (pendingInput && !pendingInput.disabled) throw new Error('PIN foi liberado de novo durante confirmação do estado');
    await wait(() => !document.querySelector('.operator-access'), 'PIN confirmado não liberou a operação / auth.me ficou em null');
    await wait(() => [...document.querySelectorAll('h1')].some(el => el.textContent.includes('KDS Cozinha')), 'KDS não hidratou após PIN');
    if (unlockCount !== 1) throw new Error('Primeiro acesso exigiu mais de uma confirmação');
    results.push('Uma única confirmação de PIN liberou a operação, inclusive com status atrasado.');
    const before = printCount;
    const kds = document.querySelector('.min-h-screen.bg-gradient-to-br.from-gray-950')?.closest('div[aria-hidden="false"]');
    if (!kds) throw new Error('Elemento KDS não encontrado');
    kds.dataset.qaPreserved = 'yes';
    let revalidationFlashes = 0;
    const observer = new MutationObserver(() => { if (document.querySelector('.operator-access')) revalidationFlashes++; });
    observer.observe(document.body, { subtree: true, childList: true });
    try { signal('status'); await pause(150); signal('status'); await pause(150); signal('status'); await pause(1400); }
    finally { observer.disconnect(); }
    if (revalidationFlashes) throw new Error('Tela de aniversário reapareceu durante revalidação ativa');
    if (document.querySelector('[data-qa-preserved="yes"]') !== kds) throw new Error('Revalidação desmontou o KDS');
    results.push('Revalidações de estado não mostraram aniversário nem desmontaram a operação ativa.');
    statusDelay = 0;
    state = 'LOCKED'; signal('lock'); signal('status');
    await wait(() => document.querySelector('input[name="operator-pin"]'), 'Bloqueio não ocultou a operação');
    const path = location.pathname;
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    await pause(100);
    if (location.pathname !== path) throw new Error('Atalho escapou do bloqueio');
    statusDelay = 650;
    await submitPin();
    await wait(() => !document.querySelector('.operator-access'), 'Um PIN após bloqueio não restabeleceu a tela');
    if (unlockCount !== 2) throw new Error('O retorno após bloqueio exigiu mais de um PIN');
    const preserved = document.querySelector('[data-qa-preserved="yes"]');
    if (preserved !== kds) throw new Error(`Wrapper KDS desmontou; tickets antes=${before}, agora=${printCount}`);
    await pause(800);
    if (printCount !== before) throw new Error('Bloqueio/desbloqueio reimprimiu item recente');
    results.push('Bloqueio real pediu um PIN; montagem e impressão foram preservadas, sem atalhos liberados.');
    return { success: true, results, mockedRequests: calls.length, printsIntercepted: printCount, unlocks: unlockCount, revalidationFlashes };
  } finally {
    window.fetch = originalFetch;
    if (originals.company) document.cookie = `activeCompanyId=${originals.company};path=/`; else document.cookie = 'activeCompanyId=;path=/;max-age=0';
    if (originals.branch) document.cookie = `activeBranchId=${originals.branch};path=/`; else document.cookie = 'activeBranchId=;path=/;max-age=0';
    history.replaceState({}, '', originalPath); window.dispatchEvent(new PopStateEvent('popstate'));
    signal('logout');
  }
}
