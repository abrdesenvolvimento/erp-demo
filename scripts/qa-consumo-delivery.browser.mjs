// QA apenas no navegador de desenvolvimento. Intercepta TODAS as APIs.
// Nenhum funcionário, consumo, venda ou movimento real é cadastrado.
export async function installConsumptionDeliveryQA(target = '/consumo', awaitRender = true) {
  window.__consumptionDeliveryQA?.cleanup();
  const original = { fetch: window.fetch, path: location.pathname,
    company: document.cookie.match(/(?:^| )activeCompanyId=([^;]+)/)?.[1],
    branch: document.cookie.match(/(?:^| )activeBranchId=([^;]+)/)?.[1] };
  const user = { id: 'qa-consumo', name: 'QA — operador fictício', role: 'admin', email: 'qa@example.invalid', blocked: false, avatarUrl: null };
  const employees = [{ id: 901, name: 'Ana — QA fictício', active: true }, { id: 902, name: 'Bruno — QA fictício', active: true }];
  const products = [{ id: 801, name: 'Refrigerante — QA fictício', uom: 'UN', currentStock: 20, avgCost: '3.50', isComposite: false, branchId: 2 }, { id: 802, name: 'Lanche composto — QA fictício', uom: 'UN', currentStock: 0, avgCost: '0.00', isComposite: true, branchId: 2 }];
  const records = [{ id: 701, companyId: 2, branchId: 2, employeeId: 902, employeeName: employees[1].name, consumedAt: new Date().toISOString(), reason: 'Refeição da equipe — QA fictício', totalCost: '7.00', totalUnits: 2, status: 'ACTIVE', createdBy: user.id, createdByName: user.name, createdAt: new Date().toISOString(), cancelledAt: null, cancelledBy: null, cancelledByName: null, cancellationReason: null,
    items: [{ id: 601, productId: 801, productName: products[0].name, quantity: 2, unitCost: '3.50', totalCost: '7.00', uom: 'UN' }], stockItems: [{ id: 601, productId: 801, productName: products[0].name, quantity: 2, unitCost: '3.50', totalCost: '7.00', uom: 'UN', movementId: 501, reversalMovementId: null }] }];
  const sales = ['IFOOD', '99FOOD', null].map((platform, index) => ({ id: 1001 + index, companyId: 2, branchId: 2, saleType: 'DELIVERY', saleDate: new Date().toISOString(), customerName: null, channelName: 'Delivery', platformOrderId: ['0372', '9950', '8801'][index], deliveryPlatform: platform, effectiveDeliveryPlatform: platform, subtotal: '30.00', discountAmount: '0.00', surchargeAmount: '0.00', finalAmount: '30.00', paymentMethod: 'PIX', status: 'ACTIVE', createdBy: user.id }));
  const calls = [];
  let state = 'ACTIVE', lastActivity = Date.now(), nextRecord = 702;
  const cutoff = (() => { const now = Date.now(), b = new Date(now - 10800000); const c = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate(), 7); return now < c ? c : c + 86400000; })();
  const snapshot = () => ({ state, user, company: { id: 2, name: 'A Brasa — QA fictício', logoUrl: null }, sessionRef: 'qa-consumo-ref', idleMinutes: 30, serverNow: Date.now(), lastActivityAt: lastActivity, expiresAt: cutoff, retryAfterSeconds: 0, hasPin: true, productionTerminal: null });
  const filterSales = input => sales.filter(s => !input?.deliveryPlatform || (input.deliveryPlatform === 'NAO_INFORMADO' ? !s.effectiveDeliveryPlatform : s.effectiveDeliveryPlatform === input.deliveryPlatform));
  function respond(path, input) {
    calls.push({ path, input });
    if (path === 'operatorSecurity.status') return snapshot();
    if (path === 'auth.me') return user;
    if (path === 'operatorSecurity.activity') { lastActivity = Date.now(); return { success: true, status: snapshot() }; }
    if (path === 'company.myCompanies') return [{ companyId: 2, branchId: 2, role: 'admin', isDefault: true, companyName: 'A Brasa — QA fictício', companyLegalName: 'A Brasa — QA fictício', companyLogoUrl: null, branchName: 'QA', segment: 'Hamburgueria' }];
    if (path === 'company.setActive') return { success: true };
    if (path.startsWith('consumption.')) {
      if (input?.companyId !== 2 || input?.branchId !== 2) throw Error('QA: consulta sem contexto isolado');
      if (path === 'consumption.employees') return input.includeInactive ? employees : employees.filter(e => e.active);
      if (path === 'consumption.products') return products.filter(p => !input.search || p.name.toLowerCase().includes(input.search.toLowerCase()));
      if (path === 'consumption.list') {
        const filtered = records.filter(r => (!input.employeeId || r.employeeId === input.employeeId) && (!input.status || r.status === input.status));
        const active = filtered.filter(r => r.status === 'ACTIVE');
        return { items: filtered, total: filtered.length, summary: { totalCost: active.reduce((sum, r) => sum + Number(r.totalCost), 0).toFixed(2), records: active.length, units: active.reduce((sum, r) => sum + r.totalUnits, 0) }, byEmployee: employees.map(e => { const rows = active.filter(r => r.employeeId === e.id); return { employeeId: e.id, employeeName: e.name, totalCost: rows.reduce((sum, r) => sum + Number(r.totalCost), 0).toFixed(2), records: rows.length }; }).filter(e => e.records) };
      }
      if (path === 'consumption.get') return records.find(r => r.id === input.id);
      if (path === 'consumption.create') {
        if (!input.requestKey || input.items.length !== 1 || input.items[0].productId !== 801 || input.items[0].quantity !== 1) throw Error('QA: payload inesperado');
        const employee = employees.find(e => e.id === input.employeeId);
        const item = { id: 602, productId: 801, productName: products[0].name, quantity: 1, unitCost: '3.50', totalCost: '3.50', uom: 'UN' };
        const record = { ...records[0], id: nextRecord++, employeeId: employee.id, employeeName: employee.name, totalCost: '3.50', totalUnits: 1, reason: input.reason, items: [item], stockItems: [{ ...item, movementId: 502, reversalMovementId: null }] };
        records.unshift(record); return { id: record.id };
      }
      if (path === 'consumption.cancel') { const record = records.find(r => r.id === input.id); record.status = 'CANCELLED'; record.cancellationReason = input.reason; record.cancelledByName = user.name; record.cancelledAt = new Date().toISOString(); return { id: record.id, success: true }; }
      if (path === 'consumption.saveEmployee') return { id: input.id || 903 };
    }
    if (path === 'sales.list') return filterSales(input);
    if (path === 'sales.stats') { const rows = filterSales(input), total = { count: rows.length, total: (rows.length * 30).toFixed(2) }, empty = { count: 0, total: '0.00' }; return { balcao: empty, delivery: total, aPrazo: empty, salao: empty, total }; }
    if (path === 'salesChannels.list') return [
      { id: 11, companyId: 2, branchId: 2, name: 'Delivery', code: 'DELIVERY', type: 'DELIVERY', active: true },
      { id: 12, companyId: 2, branchId: 2, name: 'Delivery 99Food — QA fictício', code: '99FOOD', type: 'DELIVERY', active: true },
    ];
    if (path === 'products.list') return [{ ...products[0], prices: [{ channelId: 12, price: '8.00' }] }];
    if (path === 'products.getWithPrices') return { ...products[0], prices: [{ channelId: 12, price: '8.00' }] };
    if (path === 'sales.create') {
      if (input.saleType !== 'DELIVERY' || input.channelId !== 12 || input.deliveryPlatform !== '99FOOD') throw Error('QA: origem manual diferente da seleção 99Food');
      return { id: 1004, success: true };
    }
    if (path === 'sales.getById') return sales.find(s => s.id === input.id);
    return [];
  }
  window.fetch = async (request, init) => {
    const url = new URL(String(request instanceof Request ? request.url : request), document.baseURI);
    if (url.pathname.startsWith('/api/trpc/')) {
      const paths = decodeURIComponent(url.pathname.split('/api/trpc/')[1]).split(',');
      let payload = {}; try { payload = JSON.parse(url.searchParams.get('input') || init?.body || '{}'); } catch {}
      const result = paths.map((path, index) => ({ result: { data: { json: respond(path, payload[index]?.json) } } }));
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname.startsWith('/api/') || url.hostname === '127.0.0.1') return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
    return original.fetch.call(window, request, init);
  };
  document.cookie = 'activeCompanyId=2;path=/'; document.cookie = 'activeBranchId=2;path=/';
  const navigate = path => { history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); window.dispatchEvent(new CustomEvent('abrwf:operator-security', { detail: { type: 'status', nonce: crypto.randomUUID() } })); };
  const banner = document.createElement('div'); banner.id = 'qa-consumo-label'; banner.textContent = 'QA — DADOS FICTÍCIOS; NENHUMA BAIXA REAL'; banner.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:999999;padding:6px;border:1px solid #b45309;background:#fffbeb;color:#78350f;font-size:11px;pointer-events:none'; document.body.append(banner);
  window.__consumptionDeliveryQA = { calls, records, navigate, cleanup() {
    window.fetch = original.fetch; banner.remove();
    document.cookie = original.company ? `activeCompanyId=${original.company};path=/` : 'activeCompanyId=;path=/;max-age=0';
    document.cookie = original.branch ? `activeBranchId=${original.branch};path=/` : 'activeBranchId=;path=/;max-age=0';
    history.replaceState({}, '', original.path); window.dispatchEvent(new PopStateEvent('popstate')); window.dispatchEvent(new CustomEvent('abrwf:operator-security', { detail: { type: 'logout', nonce: crypto.randomUUID() } }));
  } };
  navigate(target);
  if (!awaitRender) return { fixture: true, apisIntercepted: true };
  await waitFor(() => document.querySelector('h1')?.textContent?.includes(target === '/consumo' ? 'Consumo' : 'Vendas'));
  await waitFor(() => target === '/consumo' ? document.body.innerText.includes(employees[1].name) : document.body.innerText.includes('9950'));
  return { fixture: true, title: document.querySelector('h1')?.textContent, overflow: document.documentElement.scrollWidth > innerWidth + 1, calls: calls.length };
}
export async function waitFor(predicate, timeout = 12000) { const start = Date.now(); while (!predicate()) { if (Date.now() - start > timeout) throw Error('QA: timeout'); await new Promise(resolve => setTimeout(resolve, 70)); } }
export async function qaClick(text) { const button = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === text && !e.disabled); if (!button) throw Error('QA: botão não encontrado: ' + text); button.click(); await new Promise(r => setTimeout(r, 180)); }
export async function qaFill(id, value) { const input = document.getElementById(id); if (!input) throw Error('QA: campo não encontrado: ' + id); const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 120)); }
export async function runConsumptionCreateQA() {
  await qaClick('Registrar consumo');
  document.getElementById('consumption-employee').click(); await waitFor(() => document.querySelector('[role="option"]'));
  [...document.querySelectorAll('[role="option"]')].find(e => e.textContent.includes('Ana')).click();
  await new Promise(r => setTimeout(r, 120));
  document.querySelector('[aria-label="Pesquisar produto para consumo"]').click();
  await waitFor(() => [...document.querySelectorAll('[cmdk-item]')].some(e => e.textContent.includes('Refrigerante')));
  [...document.querySelectorAll('[cmdk-item]')].find(e => e.textContent.includes('Refrigerante')).click();
  await qaFill('consumption-reason', 'Refeição da equipe — teste fictício');
  await qaClick('Revisar e registrar'); await qaClick('Confirmar e baixar estoque');
  await waitFor(() => window.__consumptionDeliveryQA.calls.some(c => c.path === 'consumption.create'));
  await waitFor(() => document.body.innerText.includes('Refeição da equipe — teste fictício'));
  const creates = window.__consumptionDeliveryQA.calls.filter(c => c.path === 'consumption.create');
  if (creates.length !== 1) throw Error('QA: submissão duplicada');
  return { submittedOnce: true, scope: { companyId: creates[0].input.companyId, branchId: creates[0].input.branchId }, requestKeyPresent: Boolean(creates[0].input.requestKey), revenuePayloadAbsent: !('subtotal' in creates[0].input), fixture: true };
}

export async function runManual99FoodQA() {
  if (document.body.innerText.includes('Editar plataforma')) throw Error('QA: edição posterior ainda visível');
  await qaClick('Nova Venda');
  const deliveryCard = [...document.querySelectorAll('h3')].find(e => e.textContent === 'DELIVERY');
  if (!deliveryCard) throw Error('QA: opção Delivery ausente');
  deliveryCard.closest('[data-slot="card"]').click();
  await waitFor(() => document.getElementById('channel'));
  document.getElementById('channel').click();
  await waitFor(() => [...document.querySelectorAll('[role="option"]')].some(e => e.textContent.includes('Delivery 99Food')));
  [...document.querySelectorAll('[role="option"]')].find(e => e.textContent.includes('Delivery 99Food')).click();
  await waitFor(() => document.getElementById('delivery-platform')?.textContent.includes('99Food'));
  const prefilled = document.getElementById('delivery-platform').textContent.includes('99Food');
  await qaFill('platformOrderId', '9951-QA');
  const search = document.querySelector('input[placeholder="Buscar produto por nome ou EAN..."]');
  if (!search) throw Error('QA: pesquisa de produto ausente');
  search.id = 'qa-product-search';
  await qaFill('qa-product-search', 'Refrigerante');
  await waitFor(() => [...document.querySelectorAll('div.cursor-pointer')].some(e => e.textContent.includes('Refrigerante — QA fictício')));
  [...document.querySelectorAll('div.cursor-pointer')].find(e => e.textContent.includes('Refrigerante — QA fictício')).click();
  await waitFor(() => document.body.innerText.includes('Disp: 20'));
  search.closest('.flex').querySelector('button').click();
  await waitFor(() => document.body.innerText.includes('Preço Un.'));
  const payment = document.querySelector('label[for="payment"]')?.parentElement.querySelector('[role="combobox"]');
  if (!payment) throw Error('QA: pagamento ausente');
  payment.click();await waitFor(() => document.querySelector('[role="option"]'));
  const paid = [...document.querySelectorAll('[role="option"]')].find(e => e.textContent === 'Pago na Plataforma');
  if (!paid) throw Error('QA: pagamento na plataforma ausente');
  paid.click();await new Promise(r => setTimeout(r,120));
  await qaClick('Finalizar Venda');
  await waitFor(() => window.__consumptionDeliveryQA.calls.some(c => c.path === 'sales.create'));
  const creates = window.__consumptionDeliveryQA.calls.filter(c => c.path === 'sales.create');
  if (creates.length !== 1) throw Error('QA: criação repetida');
  return { fixture: true, prefilledFromSelectedChannel: prefilled, channel: creates[0].input.channelId, submittedPlatform: creates[0].input.deliveryPlatform, submittedOnce: true, postCreationEditAbsent: !document.body.innerText.includes('Editar plataforma') };
}
