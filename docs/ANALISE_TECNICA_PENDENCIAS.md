# Análise Técnica das Pendências - ABRWF

**Data:** 03/02/2026  
**Autora:** Aurora (Desenvolvedora Principal)  
**Para revisão:** Orion (Co-Desenvolvedor)

---

## 📋 RESUMO EXECUTIVO

Este documento apresenta a análise técnica de cada pendência do ABRWF, com sugestões de solução e código proposto para revisão antes da implementação.

**Classificação de Prioridade:**
- 🔴 **P1 - Crítico**: Bugs que afetam operação diária
- 🟠 **P2 - Alto**: Melhorias importantes para integridade de dados
- 🟡 **P3 - Médio**: Novos módulos e funcionalidades
- 🟢 **P4 - Baixo**: Melhorias visuais e documentação

---

## 🔴 P1 - BUGS CRÍTICOS

### BUG-01: Vendas Delivery - Número do Pedido

**Problema:** Ao editar venda Delivery, não traz o número do pedido lançado inicialmente e não salva alterações.

**Análise:** O campo `purchaseOrderId` (número do pedido iFood/Rappi) não está sendo carregado no formulário de edição e não está sendo enviado no payload de atualização.

**Arquivos afetados:**
- `client/src/pages/Vendas.tsx` (formulário de edição)
- `server/routers.ts` (endpoint sales.update)

**Solução proposta:**

```typescript
// client/src/pages/Vendas.tsx - No useEffect de carregamento da venda para edição
useEffect(() => {
  if (editingSale) {
    // ... outros campos
    setPurchaseOrderId(editingSale.purchaseOrderId || ''); // ADICIONAR
  }
}, [editingSale]);

// No handleSubmit - garantir que purchaseOrderId seja enviado
const payload = {
  // ... outros campos
  purchaseOrderId: saleType === 'DELIVERY' ? purchaseOrderId : null, // ADICIONAR
};
```

```typescript
// server/routers.ts - No endpoint sales.update
update: protectedProcedure
  .input(z.object({
    id: z.number(),
    // ... outros campos
    purchaseOrderId: z.string().nullable().optional(), // VERIFICAR SE EXISTE
  }))
  .mutation(async ({ input }) => {
    // Garantir que purchaseOrderId seja atualizado
    await db.update(sales)
      .set({
        // ... outros campos
        purchaseOrderId: input.purchaseOrderId, // VERIFICAR SE ESTÁ SENDO ATUALIZADO
      })
      .where(eq(sales.id, input.id));
  }),
```

**Estimativa:** 1-2 horas

---

### BUG-02: Edição de Compras - Juros

**Problema:** Ao editar uma compra inserindo juros, não está salvando o novo valor dos produtos e o total da nota não atualiza.

**Análise:** Quando juros são adicionados, o sistema deveria:
1. Recalcular o valor unitário de cada item proporcionalmente
2. Atualizar o custo médio dos produtos
3. Atualizar o total da compra

**Arquivos afetados:**
- `client/src/pages/Compras.tsx`
- `server/routers.ts` (endpoint purchases.update)
- `server/db.ts` (função updatePurchase)

**Solução proposta:**

```typescript
// server/db.ts - Função para recalcular valores com juros
export async function recalculatePurchaseWithInterest(
  purchaseId: number, 
  interestAmount: number
) {
  const db = await getDb();
  if (!db) return;

  // Buscar compra e itens
  const [purchase] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, purchaseId));
  const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseId));

  // Calcular subtotal original (sem juros)
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
  
  // Fator de rateio
  const factor = (subtotal + interestAmount) / subtotal;

  // Atualizar cada item com novo valor
  for (const item of items) {
    const newUnitPrice = Number(item.unitPrice) * factor;
    
    await db.update(purchaseOrderItems)
      .set({ unitPrice: newUnitPrice.toFixed(2) })
      .where(eq(purchaseOrderItems.id, item.id));

    // Recalcular custo médio do produto
    await recalculateAvgCost(item.productId);
  }

  // Atualizar total da compra
  await db.update(purchaseOrders)
    .set({ 
      totalAmount: (subtotal + interestAmount).toFixed(2),
      interestAmount: interestAmount.toFixed(2)
    })
    .where(eq(purchaseOrders.id, purchaseId));
}
```

**Estimativa:** 2-3 horas

---

### BUG-03: Timezone

**Problema:** Verificar se ainda existem módulos ou funções com divergência de timezone.

**Análise:** Necessário auditar todas as funções que manipulam datas para garantir consistência com timezone de Brasília (GMT-3).

**Arquivos a auditar:**
- `server/db.ts` - Todas as funções com datas
- `client/src/pages/*.tsx` - Formatação de datas
- `server/routers.ts` - Inputs de datas

**Solução proposta:**

```typescript
// shared/utils/date.ts - Utilitário centralizado de datas
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const TIMEZONE = 'America/Sao_Paulo';

export function toBrasiliaTime(date: Date | string): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(d, TIMEZONE);
}

export function fromBrasiliaTime(date: Date): Date {
  return fromZonedTime(date, TIMEZONE);
}

export function formatBrasiliaDate(date: Date | string, formatStr: string = 'dd/MM/yyyy'): string {
  return format(toBrasiliaTime(date), formatStr);
}

export function getStartOfDayBrasilia(date: Date = new Date()): Date {
  return startOfDay(toBrasiliaTime(date));
}

export function getEndOfDayBrasilia(date: Date = new Date()): Date {
  return endOfDay(toBrasiliaTime(date));
}
```

**Estimativa:** 3-4 horas (auditoria + correções)

---

## 🟠 P2 - MELHORIAS PRIORITÁRIAS

### Vendas A Prazo - Alterar Cliente

**Problema:** Não é possível alterar cliente em venda a prazo já lançada.

**Análise:** Ao alterar o cliente, é necessário:
1. Atualizar o `customerId` na venda
2. Recalcular saldo do cliente antigo (devolver crédito)
3. Recalcular saldo do cliente novo (debitar crédito)
4. Transferir parcelas do receivables

**Solução proposta:**

```typescript
// server/db.ts
export async function changeCustomerOnSale(
  saleId: number, 
  newCustomerId: number
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Buscar venda atual
  const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
  if (!sale) throw new Error('Venda não encontrada');
  if (sale.saleType !== 'A_PRAZO') throw new Error('Apenas vendas a prazo podem ter cliente alterado');

  const oldCustomerId = sale.customerId;
  if (!oldCustomerId) throw new Error('Venda não possui cliente');

  // Atualizar venda
  await db.update(sales)
    .set({ customerId: newCustomerId })
    .where(eq(sales.id, saleId));

  // Atualizar receivables
  await db.update(receivables)
    .set({ customerId: newCustomerId })
    .where(and(
      eq(receivables.saleId, saleId),
      eq(receivables.customerId, oldCustomerId)
    ));

  // Recalcular saldos
  await recalculateCustomerBalance(oldCustomerId);
  await recalculateCustomerBalance(newCustomerId);

  return { success: true };
}
```

**Estimativa:** 2-3 horas

---

### Compras e Despesas - Trava de Edição

**Problema:** Implementar prazo máximo de 3 dias para edição/cancelamento.

**Análise:** Após 3 dias da data de lançamento, compras e despesas não podem ser editadas ou canceladas (apenas visualizadas).

**Solução proposta:**

```typescript
// shared/utils/businessRules.ts
export const EDIT_LOCK_DAYS = 3;

export function canEditTransaction(createdAt: Date | string): boolean {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= EDIT_LOCK_DAYS;
}

export function getEditLockMessage(createdAt: Date | string): string {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const lockDate = new Date(created);
  lockDate.setDate(lockDate.getDate() + EDIT_LOCK_DAYS);
  return `Edição bloqueada. Prazo expirou em ${format(lockDate, 'dd/MM/yyyy')}.`;
}
```

```typescript
// server/routers.ts - Adicionar validação nos endpoints de update/delete
update: protectedProcedure
  .input(/* ... */)
  .mutation(async ({ input }) => {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, input.id));
    
    if (!canEditTransaction(expense.createdAt)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: getEditLockMessage(expense.createdAt)
      });
    }
    
    // ... resto da lógica
  }),
```

**Estimativa:** 2 horas

---

### Compras - Produto Duplicado

**Problema:** Produto já selecionado não deve aparecer novamente no autocomplete.

**Análise:** Filtrar produtos já adicionados da lista de sugestões.

**Solução proposta:**

```typescript
// client/src/pages/Compras.tsx - No componente de autocomplete
const availableProducts = useMemo(() => {
  const selectedIds = new Set(items.map(item => item.productId));
  return products.filter(p => !selectedIds.has(p.id));
}, [products, items]);

// Usar availableProducts no autocomplete ao invés de products
```

**Estimativa:** 30 minutos

---

## 🟡 P3 - NOVOS MÓDULOS

### Módulo Contabilidade

**Análise:** Criar menu dedicado com:
- Plano de Contas Contábil (já existe parcialmente)
- Plano de Contas Gerencial (já existe)
- Contas Bancárias (novo)
- Relatórios: Razão, Balanço, DRE

**Estrutura de arquivos proposta:**
```
client/src/pages/
  contabilidade/
    PlanoContasContabil.tsx
    PlanoContasGerencial.tsx
    ContasBancarias.tsx
    Razao.tsx
    Balanco.tsx
    DRE.tsx
```

**Estimativa:** 15-20 horas (módulo completo)

---

### Importador iFood

**Análise:** Módulo para importar pedidos do iFood via JSON.

**Estrutura de dados proposta:**

```typescript
// drizzle/schema.ts - Novas tabelas
export const ifoodImports = mysqlTable("ifoodImports", {
  id: int("id").primaryKey().autoincrement(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  importDate: timestamp("importDate").defaultNow(),
  status: mysqlEnum("status", ["PENDING", "PROCESSING", "COMPLETED", "ERROR"]).default("PENDING"),
  totalOrders: int("totalOrders").default(0),
  importedOrders: int("importedOrders").default(0),
  skippedOrders: int("skippedOrders").default(0),
  errorLog: text("errorLog"),
  userId: varchar("userId", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const ifoodOrderMappings = mysqlTable("ifoodOrderMappings", {
  id: int("id").primaryKey().autoincrement(),
  ifoodProductId: varchar("ifoodProductId", { length: 100 }).notNull(),
  ifoodProductName: varchar("ifoodProductName", { length: 255 }).notNull(),
  erpProductId: int("erpProductId"),
  status: mysqlEnum("status", ["MAPPED", "PENDING", "IGNORED"]).default("PENDING"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
```

**Estimativa:** 20-25 horas (módulo completo)

---

### Outras Receitas

**Análise:** Módulo para registrar receitas não vinculadas a vendas.

**Estrutura proposta:**

```typescript
// drizzle/schema.ts
export const otherRevenues = mysqlTable("otherRevenues", {
  id: int("id").primaryKey().autoincrement(),
  description: varchar("description", { length: 255 }).notNull(),
  revenueAccountId: int("revenueAccountId").notNull(), // Conta de receita
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  revenueDate: timestamp("revenueDate").notNull(),
  revenueType: mysqlEnum("revenueType", [
    "EMPRESTIMO", 
    "BONIFICACAO", 
    "ACORDO", 
    "JUROS_RECEBIDOS",
    "OUTROS"
  ]).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
```

**Estimativa:** 8-10 horas

---

## 🟢 P4 - MELHORIAS VISUAIS E DOCUMENTAÇÃO

### Tela de Fechamento - Ajustes

**Itens:**
1. Remover "Despesas por Categoria" (não utilizado)
2. Mover DRE para módulo Contabilidade
3. Remover coluna "Código" do quadro Despesas por Conta Gerencial
4. Adicionar "Compras por Categoria de Produtos"
5. Adicionar logo no cabeçalho de impressão

**Estimativa:** 3-4 horas

---

### Análises - Melhorias

**Itens:**
1. Calendário com feriados destacados
2. Quantidade de vendas e ticket médio por canal
3. Faturamento diário médio

**Estimativa:** 4-5 horas

---

### Dashboard - Card de Crédito

**Solução proposta:**

```typescript
// Novo card no Dashboard
const CreditControlCard = () => {
  const { data: creditData } = trpc.partners.getCreditSummary.useQuery();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Controle de Crédito</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Limite Total Concedido</span>
            <span>{formatCurrency(creditData?.totalLimit)}</span>
          </div>
          <div className="flex justify-between">
            <span>Valor Utilizado</span>
            <span className="text-red-500">{formatCurrency(creditData?.usedAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Saldo Disponível</span>
            <span className="text-green-500">{formatCurrency(creditData?.availableAmount)}</span>
          </div>
          <Progress value={creditData?.utilizationPercent} />
          <span className="text-sm text-muted-foreground">
            {creditData?.utilizationPercent?.toFixed(1)}% utilizado
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
```

**Estimativa:** 2 horas

---

## 📊 RESUMO DE PRIORIDADES

| Prioridade | Item | Estimativa |
|------------|------|------------|
| 🔴 P1 | BUG-01: Número do Pedido | 1-2h |
| 🔴 P1 | BUG-02: Juros em Compras | 2-3h |
| 🔴 P1 | BUG-03: Timezone | 3-4h |
| 🟠 P2 | Alterar Cliente A Prazo | 2-3h |
| 🟠 P2 | Trava de Edição 3 dias | 2h |
| 🟠 P2 | Produto Duplicado | 30min |
| 🟡 P3 | Módulo Contabilidade | 15-20h |
| 🟡 P3 | Importador iFood | 20-25h |
| 🟡 P3 | Outras Receitas | 8-10h |
| 🟢 P4 | Ajustes Fechamento | 3-4h |
| 🟢 P4 | Melhorias Análises | 4-5h |
| 🟢 P4 | Card Crédito Dashboard | 2h |

**Total estimado:** ~65-80 horas

---

## 🔄 SUGESTÃO DE ORDEM DE EXECUÇÃO

1. **Sprint 1 (Bugs Críticos):** BUG-01, BUG-02, Produto Duplicado (~5h)
2. **Sprint 2 (Integridade):** Trava de Edição, Alterar Cliente, BUG-03 (~8h)
3. **Sprint 3 (Fechamento):** Ajustes na tela de Fechamento (~4h)
4. **Sprint 4 (Análises):** Melhorias nas telas de Análise (~5h)
5. **Sprint 5 (Contabilidade):** Módulo Contabilidade (~20h)
6. **Sprint 6 (iFood):** Importador iFood (~25h)
7. **Sprint 7 (Receitas):** Outras Receitas + Card Crédito (~12h)

---

**Aguardo revisão do Orion antes de iniciar implementação.**
