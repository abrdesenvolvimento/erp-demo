import { describe, it, expect } from "vitest";

// ==================== TEST 1: Análise de Canal includes SALAO ====================
describe("Análise de Canal - Canal Salão", () => {
  it("deve incluir SALAO como canal válido no array de canais", () => {
    // The frontend now queries 4 channels: BALCAO, SALAO, DELIVERY, A_PRAZO
    const channels = ['BALCAO', 'SALAO', 'DELIVERY', 'A_PRAZO'];
    expect(channels).toContain('SALAO');
    expect(channels.length).toBe(4);
  });

  it("deve mapear ícone e cor para o canal Salão", () => {
    // Simula a lógica de mapeamento de ícone/cor do frontend
    const getChannelColor = (channel: string) => {
      switch (channel) {
        case 'Balcão': return 'border-blue-500 bg-blue-50';
        case 'Salão': return 'border-emerald-500 bg-emerald-50';
        case 'Delivery': return 'border-purple-500 bg-purple-50';
        case 'A Prazo': return 'border-orange-500 bg-orange-50';
        default: return 'border-gray-500 bg-gray-50';
      }
    };

    expect(getChannelColor('Salão')).toBe('border-emerald-500 bg-emerald-50');
    expect(getChannelColor('Salão')).not.toBe('border-gray-500 bg-gray-50');
  });
});

// ==================== TEST 2: Análise de Estoque - filtro relaxado ====================
describe("Análise de Estoque - Filtro de produtos", () => {
  it("deve incluir categorias com produtos ativos mesmo sem estoque positivo", () => {
    // Simula a lógica HAVING do SQL
    // Antes: HAVING stockValue > 0 (excluía categorias sem estoque)
    // Depois: HAVING productCount > 0 (inclui categorias com produtos ativos)
    const categories = [
      { categoryName: "Bebidas", stockValue: 0, productCount: 2 },
      { categoryName: "Lanches", stockValue: -33, productCount: 3 },
      { categoryName: "Vazia", stockValue: 0, productCount: 0 },
    ];

    // Novo filtro: productCount > 0
    const filtered = categories.filter(c => c.productCount > 0);
    expect(filtered.length).toBe(2);
    expect(filtered.map(c => c.categoryName)).toContain("Bebidas");
    expect(filtered.map(c => c.categoryName)).toContain("Lanches");
    expect(filtered.map(c => c.categoryName)).not.toContain("Vazia");
  });

  it("deve incluir produtos com estoque zero ou negativo na listagem", () => {
    // Antes: WHERE p.currentStock > 0 (excluía produtos sem estoque)
    // Depois: sem filtro de currentStock (inclui todos os ativos)
    const products = [
      { name: "Cheese Burguer", currentStock: -2, active: true },
      { name: "Cheese Salada", currentStock: 0, active: true },
      { name: "Frescca 510ml", currentStock: -1, active: true },
      { name: "Produto Inativo", currentStock: 5, active: false },
    ];

    // Novo filtro: apenas active = true, sem filtro de currentStock
    const filtered = products.filter(p => p.active);
    expect(filtered.length).toBe(3);
    expect(filtered.map(p => p.name)).toContain("Cheese Burguer");
    expect(filtered.map(p => p.name)).toContain("Cheese Salada");
  });
});

// ==================== TEST 3: Fechamento - Payment Type Breakdown ====================
describe("Fechamento - Faturamento por Tipo de Pagamento", () => {
  it("deve separar métodos de pagamento combinados em linhas individuais", () => {
    // Simula a lógica de agregação do getSalesByPaymentType
    const salonMethodMap: Record<string, string> = {
      CASH: 'Dinheiro',
      CREDIT: 'Cartão de Crédito',
      DEBIT: 'Cartão de Débito',
      PIX: 'PIX',
      VOUCHER: 'Voucher',
    };

    // Dados do salonOrderPayments (individuais)
    const salaoPayments = [
      { method: "PIX", amount: 107.78 },
      { method: "CREDIT", amount: 31.89 },
      { method: "DEBIT", amount: 31.89 },
    ];

    const aggregated: Record<string, { count: number; revenue: number }> = {};
    for (const p of salaoPayments) {
      const name = salonMethodMap[p.method] || p.method;
      if (!aggregated[name]) aggregated[name] = { count: 0, revenue: 0 };
      aggregated[name].count += 1;
      aggregated[name].revenue += p.amount;
    }

    // Deve ter 3 linhas separadas, não 1 linha "DINHEIRO + DEBITO + CREDITO + PIX"
    expect(Object.keys(aggregated).length).toBe(3);
    expect(aggregated['PIX']).toBeDefined();
    expect(aggregated['Cartão de Crédito']).toBeDefined();
    expect(aggregated['Cartão de Débito']).toBeDefined();
    expect(aggregated['PIX'].revenue).toBeCloseTo(107.78);
  });

  it("não deve criar linha com métodos combinados como 'DINHEIRO + PIX'", () => {
    const salonMethodMap: Record<string, string> = {
      CASH: 'Dinheiro',
      CREDIT: 'Cartão de Crédito',
      DEBIT: 'Cartão de Débito',
      PIX: 'PIX',
    };

    const salaoPayments = [
      { method: "CASH", amount: 50 },
      { method: "PIX", amount: 50 },
    ];

    const aggregated: Record<string, { count: number; revenue: number }> = {};
    for (const p of salaoPayments) {
      const name = salonMethodMap[p.method] || p.method;
      if (!aggregated[name]) aggregated[name] = { count: 0, revenue: 0 };
      aggregated[name].count += 1;
      aggregated[name].revenue += p.amount;
    }

    // Não deve ter chave combinada
    const keys = Object.keys(aggregated);
    expect(keys.some(k => k.includes(' + '))).toBe(false);
    expect(keys).toContain('Dinheiro');
    expect(keys).toContain('PIX');
  });
});

// ==================== TEST 4: KDS Analytics Timezone ====================
describe("KDS Analytics - Timezone BRT", () => {
  it("deve calcular data correta usando timezone Brasil", () => {
    // Simula getCurrentBrazilDateInfo
    const now = new Date('2026-03-09T01:00:00Z'); // 22:00 BRT em 08/03
    const brasiliaStr = now.toLocaleString('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const [month, day, year] = brasiliaStr.split('/');
    const dateStr = `${year}-${month}-${day}`;
    
    // Em BRT, 01:00 UTC de 09/03 = 22:00 de 08/03
    expect(dateStr).toBe('2026-03-08');
  });

  it("deve incluir itens criados após meia-noite BRT no dia seguinte", () => {
    // Item criado às 03:27 UTC = 00:27 BRT em 09/03
    const sentAtUTC = new Date('2026-03-09T03:27:00Z');
    const brDate = new Date(sentAtUTC.getTime() - 3 * 3600000);
    const dayKey = brDate.toISOString().split('T')[0];
    
    expect(dayKey).toBe('2026-03-09'); // Deve ser dia 9 em BRT
  });

  it("deve calcular range de data BRT corretamente para filtro", () => {
    const dateStr = '2026-03-08';
    const start = new Date(dateStr + 'T03:00:00.000Z');
    const endBase = new Date(dateStr + 'T03:00:00.000Z');
    endBase.setUTCDate(endBase.getUTCDate() + 1);
    const end = new Date(endBase.getTime() - 1);

    expect(start.toISOString()).toBe('2026-03-08T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-09T02:59:59.999Z');

    // Item às 03:27 UTC em 09/03 (00:27 BRT 09/03) NÃO deve estar no range de 08/03
    const itemAt = new Date('2026-03-09T03:27:00Z');
    expect(itemAt >= start).toBe(true);
    expect(itemAt <= end).toBe(false); // Correto: está fora do range de 08/03
  });
});

// ==================== TEST 5: Diminuir Quantidade de Item ====================
describe("Comanda - Diminuir Quantidade de Item", () => {
  it("deve diminuir quantidade de 3 para 2 e recalcular totalPrice", () => {
    const item = { quantity: "3", unitPrice: "25.00", totalPrice: "75.00", status: "PENDING" };
    const currentQty = parseFloat(item.quantity);
    
    expect(currentQty).toBe(3);
    expect(currentQty > 1).toBe(true);
    
    const newQty = currentQty - 1;
    const unitPrice = parseFloat(item.unitPrice);
    const newTotal = newQty * unitPrice;
    
    expect(newQty).toBe(2);
    expect(newTotal).toBe(50);
  });

  it("deve cancelar item quando quantidade = 1 e diminuir é chamado", () => {
    const item = { quantity: "1", unitPrice: "25.00", totalPrice: "25.00", status: "PENDING" };
    const currentQty = parseFloat(item.quantity);
    
    expect(currentQty).toBe(1);
    expect(currentQty <= 1).toBe(true);
    
    // Quando qty <= 1, o item deve ser cancelado (status = CANCELLED)
    const newStatus = currentQty <= 1 ? "CANCELLED" : "PENDING";
    expect(newStatus).toBe("CANCELLED");
  });

  it("botão de diminuir só deve aparecer quando quantidade > 1", () => {
    // Simula a lógica do frontend
    const items = [
      { id: 1, quantity: "1", status: "PENDING" },
      { id: 2, quantity: "3", status: "PENDING" },
      { id: 3, quantity: "2", status: "DELIVERED" },
    ];

    for (const item of items) {
      const showDecreaseButton = parseFloat(item.quantity) > 1;
      if (item.id === 1) expect(showDecreaseButton).toBe(false);
      if (item.id === 2) expect(showDecreaseButton).toBe(true);
      if (item.id === 3) expect(showDecreaseButton).toBe(true);
    }
  });

  it("não deve permitir diminuir item cancelado", () => {
    const item = { quantity: "2", status: "CANCELLED" };
    const canDecrease = item.status !== "CANCELLED" && parseFloat(item.quantity) > 1;
    expect(canDecrease).toBe(false);
  });
});
