// QA de interface, não análise de negócio: valores FIXTÍCIOS de teste.
// Todas as APIs são interceptadas; nenhuma venda, meta ou sessão real é gravada.
export async function installMetasQA() {
  const originals = { fetch: window.fetch, path: location.pathname, company: document.cookie.match(/(?:^| )activeCompanyId=([^;]+)/)?.[1], branch: document.cookie.match(/(?:^| )activeBranchId=([^;]+)/)?.[1] };
  const now = Date.now();
  const user = { id: 'qa-metas-ficticias', name: 'QA · dados fictícios', role: 'admin', email: 'qa@example.invalid', blocked: false, avatarUrl: null };
  const current = { year: 2026, month: 11, day: 3 };
  const channels = [{ id: 1, name: 'Balcão / A Prazo', code: 'BALCAO' }, { id: 2, name: 'Delivery iFood', code: 'IFOOD' }];
  const calls = [];
  let activityCalls = 0;
  let lastActivity = Math.floor(now / 1000) * 1000;
  let state = 'ACTIVE';
  const cutoff = (() => { const b = new Date(now - 10800000); const c = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate(), 7); return now < c ? c : c + 86400000; })();
  const snapshot = () => ({ state, user, company: { id: 1, name: 'QA — Empresa fictícia', logoUrl: null }, sessionRef: 'qa-metas-session-ref', idleMinutes: 1, serverNow: Date.now(), lastActivityAt: lastActivity, expiresAt: cutoff, retryAfterSeconds: 0, hasPin: true, productionTerminal: null });
  function annual(year) {
    const months = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const status = year < current.year || year === current.year && month < current.month ? 'closed' : year > current.year || month > current.month ? 'future' : 'active';
      const goals = month === 4 ? [] : channels.map((channel, j) => {
        const targetAmount = j ? 10000 : 25000;
        const currentRevenue = status === 'future' ? 0 : targetAmount * (0.65 + month * 0.045 + j * 0.08);
        const progress = Math.round(currentRevenue / targetAmount * 1000) / 10;
        return { id: year * 100 + month * 2 + j, year, month, channelId: channel.id, channelName: channel.name, channelCode: channel.code, targetAmount, currentRevenue, progress, remaining: Math.max(0, targetAmount - currentRevenue), achieved: status !== 'future' && progress >= 100, notes: 'QA somente interface — dados fictícios' };
      });
      return { year, month, status, goals, totalRevenue: goals.reduce((sum, goal) => sum + goal.currentRevenue, 0) };
    });
    return { year, current, months, series: channels.map(channel => ({ key: `channel_${channel.id}`, channelId: channel.id, name: channel.name })) };
  }
  function response(path, input) {
    calls.push(path);
    if (path === 'operatorSecurity.status') return snapshot();
    if (path === 'auth.me') return state === 'ACTIVE' ? user : null;
    if (path === 'operatorSecurity.activity') { activityCalls++; lastActivity = Math.floor(Date.now() / 1000) * 1000; return { success: true, status: snapshot() }; }
    if (path === 'operatorSecurity.unlock') { state = 'ACTIVE'; lastActivity = Math.floor(Date.now() / 1000) * 1000; return { success: true, retryAfterSeconds: 0 }; }
    if (path === 'auth.logout') { state = 'LOGIN_REQUIRED'; return { success: true }; }
    if (path === 'company.myCompanies') return [{ companyId: 1, branchId: 1, role: 'admin', isDefault: true, companyName: 'QA — Empresa fictícia', companyLegalName: 'QA — Empresa fictícia', companyLogoUrl: null, branchName: 'QA' }];
    if (path === 'company.setActive') return { success: true };
    if (path === 'salesChannels.list') return channels;
    const data = annual(input?.year ?? current.year);
    if (path === 'goals.annualProgress') return data;
    if (path === 'goals.list') return data.months.flatMap(month => month.goals);
    if (path === 'goals.progress') return data.months[(input?.month ?? current.month) - 1];
    if (path === 'goals.history') return [];
    return [];
  }
  window.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input), document.baseURI);
    if (url.pathname.startsWith('/api/trpc/')) {
      const paths = decodeURIComponent(url.pathname.split('/api/trpc/')[1]).split(',');
      let payload = {};
      try { payload = JSON.parse(url.searchParams.get('input') || init?.body || '{}'); } catch {}
      const result = paths.map((path, index) => ({ result: { data: { json: response(path, payload[index]?.json) } } }));
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname.startsWith('/api/') || url.hostname === '127.0.0.1') return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
    return originals.fetch.call(window, input, init);
  };
  document.cookie = 'activeCompanyId=1;path=/'; document.cookie = 'activeBranchId=1;path=/';
  history.pushState({}, '', '/metas'); window.dispatchEvent(new PopStateEvent('popstate'));
  window.dispatchEvent(new CustomEvent('abrwf:operator-security', { detail: { type: 'status', nonce: crypto.randomUUID() } }));
  const banner = document.createElement('div');
  banner.id = 'qa-metas-label'; banner.textContent = 'QA DE INTERFACE — TODOS OS VALORES SÃO FICTÍCIOS';
  banner.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:999999;padding:8px 12px;border:2px solid #b45309;background:#fffbeb;color:#78350f;font-size:12px;pointer-events:none';
  document.body.append(banner);
  window.__metasQA = {
    calls, get activityCalls() { return activityCalls; }, get status() { return snapshot(); },
    cleanup() { banner.remove(); window.fetch = originals.fetch;
      document.cookie = originals.company ? `activeCompanyId=${originals.company};path=/` : 'activeCompanyId=;path=/;max-age=0';
      document.cookie = originals.branch ? `activeBranchId=${originals.branch};path=/` : 'activeBranchId=;path=/;max-age=0';
      history.replaceState({}, '', originals.path); window.dispatchEvent(new PopStateEvent('popstate'));
      window.dispatchEvent(new CustomEvent('abrwf:operator-security', { detail: { type: 'logout', nonce: crypto.randomUUID() } })); }
  };
  const start = Date.now();
  while (!document.querySelector('.recharts-line') && Date.now() - start < 12000) await new Promise(resolve => setTimeout(resolve, 80));
  if (!document.querySelector('.recharts-line')) throw new Error('Gráfico não renderizou');
  return { chartRendered: true, calls: calls.length, heading: document.querySelector('h1')?.textContent,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    chartLines: document.querySelectorAll('.recharts-line').length, fixture: true };
}
