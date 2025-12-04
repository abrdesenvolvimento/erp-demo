import { describe, it, expect, beforeAll } from 'vitest';
import { appRouter } from './routers';
import type { Context } from './_core/context';

// Mock de contexto admin
const mockAdminContext: Context = {
  user: {
    id: 'admin-test',
    name: 'Admin Test',
    email: 'admin@test.com',
    role: 'admin',
    loginMethod: 'oauth',
    createdAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: {} as any,
  res: {} as any,
};

const caller = appRouter.createCaller(mockAdminContext);

describe('Purchases - Edit and Cancel', () => {
  let testPurchaseId: number;
  let testSupplierId: number;
  let testProductId: number;

  beforeAll(async () => {
    // Criar fornecedor de teste
    const supplier = await caller.partners.create({
      type: 'SUPPLIER',
      name: 'Fornecedor Teste Cancelamento',
      cpfCnpj: '12345678901234',
      email: 'fornecedor-cancel@test.com',
      phone: '11999999999',
      zipCode: '01310-100',
      street: 'Av Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    });
    testSupplierId = supplier.id;

    // Criar produto de teste
    const product = await caller.products.create({
      name: 'Produto Teste Cancelamento',
      ean: '7891234567890',
      category: 'Bebidas',
      subcategoryId: 1,
      currentStock: 100,
      minStock: 10,
      avgCost: '5.00',
      prices: {
        BALCAO: 10.00,
        DELIVERY: 12.00,
        A_PRAZO: 11.00,
      },
    });
    testProductId = product.id;
  });

  it('deve criar uma compra confirmada para teste', async () => {
    const purchase = await caller.purchases.create({
      supplierId: testSupplierId,
      docType: 'NOTA_FISCAL',
      docNumber: 'NF-CANCEL-001',
      issueDate: new Date().toISOString(),
      postingDate: new Date().toISOString(),
      paymentMethod: 'A_VISTA',
      items: [
        {
          productId: testProductId,
          quantity: 50,
          unitCost: 4.50,
        },
      ],
      installments: [
        {
          dueDate: new Date().toISOString(),
          amount: 225.00, // 50 * 4.50
        },
      ],
    });

    testPurchaseId = purchase.id;
    expect(purchase.success).toBe(true);

    // Confirmar compra
    const confirmed = await caller.purchases.confirm({ id: testPurchaseId });
    expect(confirmed.success).toBe(true);
  });

  it('deve cancelar uma compra confirmada', async () => {
    // Buscar estoque antes do cancelamento
    const productBefore = await caller.products.getById({ id: testProductId });
    const stockBefore = parseFloat(productBefore?.currentStock?.toString() || '0');

    // Cancelar compra
    const result = await caller.purchases.cancel({ id: testPurchaseId });
    expect(result.success).toBe(true);

    // Verificar se estoque foi revertido
    const productAfter = await caller.products.getById({ id: testProductId });
    const stockAfter = parseFloat(productAfter?.currentStock?.toString() || '0');
    
    expect(stockAfter).toBe(stockBefore - 50); // Estoque deve ter diminuído 50 unidades

    // Verificar se status mudou para CANCELLED
    const purchase = await caller.purchases.getById({ id: testPurchaseId });
    expect(purchase?.purchaseOrder.status).toBe('CANCELLED');
  });

  it('não deve permitir cancelar compra já cancelada', async () => {
    await expect(
      caller.purchases.cancel({ id: testPurchaseId })
    ).rejects.toThrow('Apenas compras confirmadas podem ser canceladas');
  });

  it('deve criar e editar uma compra', async () => {
    // Criar nova compra
    const purchase = await caller.purchases.create({
      supplierId: testSupplierId,
      docType: 'CUPOM',
      docNumber: 'CUPOM-EDIT-001',
      issueDate: new Date().toISOString(),
      postingDate: new Date().toISOString(),
      paymentMethod: 'A_VISTA',
      items: [
        {
          productId: testProductId,
          quantity: 20,
          unitCost: 5.00,
        },
      ],
      installments: [
        {
          dueDate: new Date().toISOString(),
          amount: 100.00,
        },
      ],
    });

    const editPurchaseId = purchase.id;

    // Confirmar compra
    await caller.purchases.confirm({ id: editPurchaseId });

    // Buscar estoque antes da edição
    const productBefore = await caller.products.getById({ id: testProductId });
    const stockBefore = parseFloat(productBefore?.currentStock?.toString() || '0');

    // Editar compra (alterar quantidade de 20 para 30)
    const result = await caller.purchases.update({
      id: editPurchaseId,
      docType: 'NOTA_FISCAL',
      docNumber: 'NF-EDIT-001',
      items: [
        {
          productId: testProductId,
          quantity: '30',
          unitCost: '5.00',
        },
      ],
    });

    expect(result.success).toBe(true);

    // Verificar se estoque foi atualizado corretamente
    const productAfter = await caller.products.getById({ id: testProductId });
    const stockAfter = parseFloat(productAfter?.currentStock?.toString() || '0');
    
    // Estoque deve ter aumentado 10 unidades (30 - 20)
    expect(stockAfter).toBe(stockBefore + 10);

    // Verificar se dados da compra foram atualizados
    const purchaseAfter = await caller.purchases.getById({ id: editPurchaseId });
    expect(purchaseAfter?.purchaseOrder.docType).toBe('NOTA_FISCAL');
    expect(purchaseAfter?.purchaseOrder.docNumber).toBe('NF-EDIT-001');
  });
});
