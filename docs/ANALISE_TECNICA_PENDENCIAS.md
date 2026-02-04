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

---

## 🟡 P3 - MÓDULOS E INTEGRAÇÕES ADICIONAIS

### Catálogo Digital

**Problema:** Integrar ERP com catálogo digital para sincronização de produtos e preços.

**Análise:** O catálogo digital precisa consumir dados do ERP em tempo real:
- Lista de produtos ativos com estoque disponível
- Preços do canal Balcão
- Indicador de disponibilidade (estoque > 0)

**Arquivos a criar:**
- `server/routers/catalogo.ts` - Endpoints públicos para o catálogo
- Documentação da API para integração

**Solução proposta:**

```typescript
// server/routers/catalogo.ts - API pública para catálogo digital
import { publicProcedure, router } from '../_core/trpc';
import { z } from 'zod';

export const catalogoRouter = router({
  // Lista produtos disponíveis para o catálogo
  produtos: publicProcedure
    .input(z.object({
      categoryId: z.number().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // Buscar produtos ativos com estoque > 0
      const produtos = await db
        .select({
          id: products.id,
          name: products.name,
          description: products.description,
          ean: products.ean,
          categoryId: products.categoryId,
          categoryName: categories.name,
          imageUrl: products.imageUrl,
          stock: products.stock,
          available: sql<boolean>`${products.stock} > 0`,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(and(
          eq(products.active, true),
          gt(products.stock, 0)
        ));

      // Buscar preços do canal Balcão (channelId = 1)
      for (const produto of produtos) {
        const [preco] = await db
          .select({ price: productPrices.price })
          .from(productPrices)
          .where(and(
            eq(productPrices.productId, produto.id),
            eq(productPrices.channelId, 1) // Balcão
          ))
          .limit(1);
        
        produto.price = preco?.price || '0.00';
      }

      return produtos;
    }),

  // Categorias disponíveis
  categorias: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    return db
      .select({
        id: categories.id,
        name: categories.name,
        parentId: categories.parentId,
      })
      .from(categories)
      .where(eq(categories.active, true));
  }),

  // Verificar disponibilidade de um produto específico
  disponibilidade: publicProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { available: false, stock: 0 };

      const [produto] = await db
        .select({ stock: products.stock })
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);

      return {
        available: Number(produto?.stock || 0) > 0,
        stock: Number(produto?.stock || 0),
      };
    }),
});
```

**Endpoint final:** `GET /api/trpc/catalogo.produtos`

**Estimativa:** 4-6 horas

---

### Backup - Correção Google Drive e Email

**Problema:** Backup não está sendo enviado para Google Drive nem notificando por email desde 15/01.

**Análise:** Verificar:
1. Credenciais do Google Drive (token expirado?)
2. Configuração do email de notificação
3. Logs de erro do processo de backup
4. Agendamento do cron job

**Arquivos a verificar:**
- `server/jobs/backup.ts` ou similar
- Variáveis de ambiente: `GOOGLE_DRIVE_CREDENTIALS`, `GOOGLE_DRIVE_FOLDER_ID`
- `BACKUP_EMAIL_NOTIFICATION`

**Solução proposta:**

```typescript
// server/jobs/backup.ts - Melhorar tratamento de erros e logs
import { google } from 'googleapis';
import { notifyOwner } from '../_core/notification';

export async function runBackup() {
  const startTime = new Date();
  const logs: string[] = [];
  
  try {
    logs.push(`[${new Date().toISOString()}] Iniciando backup...`);
    
    // 1. Gerar dump do banco
    const dumpFile = await generateDatabaseDump();
    logs.push(`[${new Date().toISOString()}] Dump gerado: ${dumpFile}`);
    
    // 2. Upload para Google Drive
    try {
      const driveResult = await uploadToGoogleDrive(dumpFile);
      logs.push(`[${new Date().toISOString()}] Upload Google Drive: ${driveResult.id}`);
    } catch (driveError) {
      logs.push(`[${new Date().toISOString()}] ERRO Google Drive: ${driveError.message}`);
      // Continuar mesmo com erro no Drive
    }
    
    // 3. Notificar conclusão
    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000);
    await notifyOwner({
      title: '✅ Backup ABRWF Concluído',
      content: `Backup realizado em ${duration}s.\n\nLogs:\n${logs.join('\n')}`,
    });
    
    return { success: true, logs };
    
  } catch (error) {
    logs.push(`[${new Date().toISOString()}] ERRO CRÍTICO: ${error.message}`);
    
    // Notificar falha
    await notifyOwner({
      title: '❌ Falha no Backup ABRWF',
      content: `Erro ao executar backup.\n\nLogs:\n${logs.join('\n')}`,
    });
    
    // Registrar em tabela de logs
    await logBackupFailure(error.message, logs);
    
    return { success: false, error: error.message, logs };
  }
}

async function uploadToGoogleDrive(filePath: string) {
  const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS || '{}');
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  
  if (!credentials.client_email || !folderId) {
    throw new Error('Credenciais do Google Drive não configuradas');
  }
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  
  const drive = google.drive({ version: 'v3', auth });
  
  const response = await drive.files.create({
    requestBody: {
      name: `backup_abrwf_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.sql`,
      parents: [folderId],
    },
    media: {
      mimeType: 'application/sql',
      body: fs.createReadStream(filePath),
    },
  });
  
  return response.data;
}
```

**Estimativa:** 3-4 horas (diagnóstico + correção)

---

### Acesso por Empresa (Multi-tenant)

**Problema:** Preparar sistema para suportar múltiplas empresas com isolamento de dados.

**Análise:** Esta é uma mudança arquitetural significativa que requer:
1. Adicionar campo `companyId` em todas as tabelas principais
2. Criar tabela de empresas
3. Modificar todas as queries para filtrar por empresa
4. Implementar middleware de contexto de empresa
5. Ajustar autenticação para vincular usuário à empresa

**Prioridade:** 🔵 P5 - Futuro (requer planejamento detalhado)

**Estrutura proposta:**

```typescript
// drizzle/schema.ts - Tabela de empresas
export const companies = mysqlTable("companies", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 200 }).notNull(),
  tradeName: varchar("tradeName", { length: 200 }),
  cnpj: varchar("cnpj", { length: 18 }),
  active: boolean("active").default(true).notNull(),
  settings: json("settings"), // Configurações específicas da empresa
  createdAt: timestamp("createdAt").defaultNow(),
});

// Adicionar em todas as tabelas principais:
// companyId: int("companyId").notNull().references(() => companies.id),

// server/_core/context.ts - Middleware de empresa
export async function getCompanyContext(userId: string) {
  const db = await getDb();
  
  // Buscar empresa do usuário
  const [userCompany] = await db
    .select({ companyId: userCompanies.companyId })
    .from(userCompanies)
    .where(eq(userCompanies.userId, userId))
    .limit(1);
  
  if (!userCompany) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Usuário sem empresa vinculada' });
  }
  
  return userCompany.companyId;
}

// Uso em procedures:
// const companyId = await getCompanyContext(ctx.user.id);
// .where(eq(products.companyId, companyId))
```

**Estimativa:** 40-60 horas (projeto completo)

**Recomendação:** Criar documento de especificação separado antes de iniciar.

---

### Histórico de Preço

**Problema:** Registrar automaticamente alterações de preço de venda e custo médio.

**Análise:** Criar tabela de histórico e triggers para registrar mudanças.

**Solução proposta:**

```typescript
// drizzle/schema.ts - Tabela de histórico de preços
export const priceHistory = mysqlTable("priceHistory", {
  id: int("id").primaryKey().autoincrement(),
  productId: int("productId").notNull(),
  priceType: mysqlEnum("priceType", ["SALE_PRICE", "AVG_COST"]).notNull(),
  channelId: int("channelId"), // null para custo médio
  previousValue: decimal("previousValue", { precision: 10, scale: 2 }),
  newValue: decimal("newValue", { precision: 10, scale: 2 }).notNull(),
  changeReason: varchar("changeReason", { length: 255 }),
  userId: varchar("userId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow(),
});

// server/db.ts - Função para registrar alteração de preço
export async function logPriceChange(
  productId: number,
  priceType: 'SALE_PRICE' | 'AVG_COST',
  previousValue: number | null,
  newValue: number,
  channelId?: number,
  userId?: string,
  reason?: string
) {
  const db = await getDb();
  if (!db) return;

  await db.insert(priceHistory).values({
    productId,
    priceType,
    channelId: channelId || null,
    previousValue: previousValue?.toFixed(2) || null,
    newValue: newValue.toFixed(2),
    changeReason: reason || null,
    userId: userId || null,
  });
}

// Integrar nas funções existentes:
// - updateProductPrice() → logPriceChange('SALE_PRICE', ...)
// - recalculateAvgCost() → logPriceChange('AVG_COST', ...)
```

```typescript
// client/src/pages/Produtos.tsx - Componente de histórico
const PriceHistoryDialog = ({ productId }: { productId: number }) => {
  const { data: history } = trpc.products.getPriceHistory.useQuery({ productId });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-2" />
          Histórico de Preços
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de Alterações de Preço</DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Anterior</TableHead>
              <TableHead>Novo</TableHead>
              <TableHead>Usuário</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history?.map((h) => (
              <TableRow key={h.id}>
                <TableCell>{format(new Date(h.createdAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                <TableCell>{h.priceType === 'SALE_PRICE' ? 'Preço Venda' : 'Custo Médio'}</TableCell>
                <TableCell>{h.channelName || '-'}</TableCell>
                <TableCell>{formatCurrency(h.previousValue)}</TableCell>
                <TableCell>{formatCurrency(h.newValue)}</TableCell>
                <TableCell>{h.userName || 'Sistema'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
};
```

**Estimativa:** 6-8 horas

---

### API WhatsApp

**Problema:** Concluir integração para automações operacionais e comerciais.

**Análise:** A integração já possui credenciais configuradas (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`). Falta implementar:
1. Helper centralizado para envio de mensagens
2. Templates de mensagens
3. Integração com eventos do sistema

**Solução proposta:**

```typescript
// server/_core/whatsapp.ts - Helper de WhatsApp
const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

interface WhatsAppMessage {
  to: string; // Número com código do país (ex: 5511999999999)
  template?: {
    name: string;
    language: string;
    components?: any[];
  };
  text?: string;
}

export async function sendWhatsAppMessage(message: WhatsAppMessage) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn('[WhatsApp] Credenciais não configuradas');
    return { success: false, error: 'Credenciais não configuradas' };
  }

  try {
    const payload = message.template
      ? {
          messaging_product: 'whatsapp',
          to: message.to,
          type: 'template',
          template: message.template,
        }
      : {
          messaging_product: 'whatsapp',
          to: message.to,
          type: 'text',
          text: { body: message.text },
        };

    const response = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Erro ao enviar mensagem');
    }

    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    console.error('[WhatsApp] Erro:', error);
    return { success: false, error: error.message };
  }
}

// Funções de conveniência para casos de uso comuns
export async function notifyCustomerPaymentDue(
  phone: string,
  customerName: string,
  amount: number,
  dueDate: Date
) {
  return sendWhatsAppMessage({
    to: phone.replace(/\D/g, ''),
    text: `Olá ${customerName}! 👋\n\nLembramos que você possui um valor de R$ ${amount.toFixed(2)} com vencimento em ${format(dueDate, 'dd/MM/yyyy')}.\n\nAdega Beira Rio`,
  });
}

export async function notifyLowStock(
  phone: string,
  productName: string,
  currentStock: number
) {
  return sendWhatsAppMessage({
    to: phone.replace(/\D/g, ''),
    text: `⚠️ Alerta de Estoque Baixo\n\nProduto: ${productName}\nEstoque atual: ${currentStock} unidades\n\nABRWF`,
  });
}
```

**Casos de uso sugeridos:**
1. Lembrete de pagamento para clientes A Prazo
2. Alerta de estoque baixo para gestor
3. Confirmação de pedido Delivery
4. Notificação de backup concluído/falha

**Estimativa:** 8-10 horas (helper + integrações)

---

### Livro (Documentação)

**Problema:** Criar documentação completa do sistema (operacional e técnica).

**Análise:** Dividir em dois documentos:
1. **Manual Operacional** - Para usuários do sistema
2. **Documentação Técnica** - Para desenvolvedores

**Estrutura proposta:**

```markdown
# Manual Operacional ABRWF

## 1. Visão Geral
- O que é o ABRWF
- Módulos disponíveis
- Perfis de acesso

## 2. Dashboard
- Indicadores principais
- Interpretação dos cards

## 3. Produtos
- Cadastro de produtos
- Categorias
- Preços por canal
- Gestão de estoque
- Movimentações

## 4. Vendas
- Venda Balcão
- Venda Delivery
- Venda A Prazo
- Cancelamento

## 5. Compras
- Registro de compras
- Entrada de estoque
- Custo médio

## 6. Financeiro
- Contas a Pagar
- Contas a Receber
- Despesas
- Fechamento Mensal

## 7. Parceiros
- Clientes
- Fornecedores
- Controle de crédito

## 8. Análises
- Faturamento
- Vendas por canal
- Margem por categoria

## 9. Configurações
- Usuários
- Metas
- Canais de venda
```

```markdown
# Documentação Técnica ABRWF

## 1. Arquitetura
- Stack tecnológico
- Estrutura de pastas
- Fluxo de dados

## 2. Backend
- tRPC Routers
- Banco de dados (Drizzle)
- Autenticação

## 3. Frontend
- Componentes React
- Estado global
- Hooks customizados

## 4. Integrações
- OAuth Manus
- Google Drive
- WhatsApp API

## 5. Deploy
- Ambiente de produção
- Variáveis de ambiente
- Backup e recuperação

## 6. Referência de API
- Endpoints disponíveis
- Schemas de entrada/saída
```

**Estimativa:** 15-20 horas (documentação completa)

---

### Auditoria (Log de Alterações)

**Problema:** Criar sistema de auditoria para rastrear alterações em entidades críticas.

**Análise:** Registrar todas as alterações em: Produtos, Parceiros, Vendas, Compras, Despesas.

**Solução proposta:**

```typescript
// drizzle/schema.ts - Tabela de auditoria
export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").primaryKey().autoincrement(),
  entityType: mysqlEnum("entityType", [
    "PRODUCT", "PARTNER", "SALE", "PURCHASE", "EXPENSE"
  ]).notNull(),
  entityId: int("entityId").notNull(),
  action: mysqlEnum("action", ["CREATE", "UPDATE", "DELETE"]).notNull(),
  userId: varchar("userId", { length: 64 }),
  userName: varchar("userName", { length: 200 }),
  changes: json("changes"), // { field: { old: value, new: value } }
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: varchar("userAgent", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow(),
});

// server/db.ts - Helper de auditoria
export async function logAudit(
  entityType: 'PRODUCT' | 'PARTNER' | 'SALE' | 'PURCHASE' | 'EXPENSE',
  entityId: number,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  changes: Record<string, { old: any; new: any }>,
  ctx?: { user?: { id: string; name: string }; req?: Request }
) {
  const db = await getDb();
  if (!db) return;

  await db.insert(auditLogs).values({
    entityType,
    entityId,
    action,
    userId: ctx?.user?.id || null,
    userName: ctx?.user?.name || null,
    changes: JSON.stringify(changes),
    ipAddress: ctx?.req?.headers?.get('x-forwarded-for') || null,
    userAgent: ctx?.req?.headers?.get('user-agent') || null,
  });
}

// Uso em procedures:
// Antes de atualizar:
const [oldProduct] = await db.select().from(products).where(eq(products.id, input.id));

// Após atualizar:
await logAudit('PRODUCT', input.id, 'UPDATE', {
  name: { old: oldProduct.name, new: input.name },
  price: { old: oldProduct.price, new: input.price },
}, ctx);
```

```typescript
// client/src/pages/Auditoria.tsx - Tela de consulta
const AuditoriaPage = () => {
  const [filters, setFilters] = useState({
    entityType: '',
    dateFrom: null,
    dateTo: null,
    userId: '',
  });

  const { data: logs } = trpc.audit.list.useQuery(filters);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Auditoria</h1>
        
        {/* Filtros */}
        <div className="flex gap-4">
          <Select value={filters.entityType} onValueChange={(v) => setFilters({ ...filters, entityType: v })}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              <SelectItem value="PRODUCT">Produtos</SelectItem>
              <SelectItem value="PARTNER">Parceiros</SelectItem>
              <SelectItem value="SALE">Vendas</SelectItem>
              <SelectItem value="PURCHASE">Compras</SelectItem>
              <SelectItem value="EXPENSE">Despesas</SelectItem>
            </SelectContent>
          </Select>
          {/* ... outros filtros */}
        </div>

        {/* Tabela de logs */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Alterações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs?.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss')}</TableCell>
                <TableCell>{log.entityType}</TableCell>
                <TableCell>{log.entityId}</TableCell>
                <TableCell>
                  <Badge variant={log.action === 'DELETE' ? 'destructive' : 'default'}>
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell>{log.userName || 'Sistema'}</TableCell>
                <TableCell>
                  <AuditChangesDialog changes={log.changes} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DashboardLayout>
  );
};
```

**Estimativa:** 10-12 horas

---

### Tela de Metas - Melhorias Visuais

**Problema:** Melhorar layout para reduzir aspecto "branco" mantendo regras de negócio.

**Análise:** Adicionar elementos visuais sem alterar funcionalidade:
- Gráficos de progresso mais elaborados
- Cards com gradientes sutis
- Indicadores visuais de tendência
- Comparativo com período anterior

**Solução proposta:**

```typescript
// client/src/pages/Metas.tsx - Melhorias visuais
const MetaCard = ({ meta, atual, anterior }: MetaCardProps) => {
  const percentual = (atual / meta) * 100;
  const tendencia = atual > anterior ? 'up' : atual < anterior ? 'down' : 'stable';
  
  return (
    <Card className="relative overflow-hidden">
      {/* Gradiente de fundo baseado no progresso */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          background: `linear-gradient(90deg, 
            ${percentual >= 100 ? '#22c55e' : percentual >= 70 ? '#eab308' : '#ef4444'} 0%, 
            transparent ${Math.min(percentual, 100)}%
          )`,
        }}
      />
      
      <CardHeader className="relative">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">{meta.channelName}</CardTitle>
          <Badge variant={percentual >= 100 ? 'success' : percentual >= 70 ? 'warning' : 'destructive'}>
            {percentual.toFixed(1)}%
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="relative space-y-4">
        {/* Valores principais */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Meta</p>
            <p className="text-xl font-bold">{formatCurrency(meta.targetAmount)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Realizado</p>
            <p className="text-xl font-bold">{formatCurrency(atual)}</p>
          </div>
        </div>
        
        {/* Barra de progresso */}
        <div className="space-y-1">
          <Progress value={Math.min(percentual, 100)} className="h-3" />
          <p className="text-xs text-muted-foreground text-right">
            Faltam {formatCurrency(Math.max(meta.targetAmount - atual, 0))}
          </p>
        </div>
        
        {/* Comparativo */}
        <div className="flex items-center gap-2 text-sm">
          {tendencia === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
          {tendencia === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
          {tendencia === 'stable' && <Minus className="h-4 w-4 text-gray-500" />}
          <span className="text-muted-foreground">
            vs. período anterior: {formatCurrency(anterior)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
```

**Estimativa:** 4-6 horas

---

## 📊 RESUMO DE PRIORIDADES (ATUALIZADO)

| Prioridade | Item | Estimativa |
|------------|------|------------|
| 🔴 P1 | BUG-01: Número do Pedido | 1-2h |
| 🔴 P1 | BUG-02: Juros em Compras | 2-3h |
| 🔴 P1 | BUG-03: Timezone | 3-4h |
| 🟠 P2 | Alterar Cliente A Prazo | 2-3h |
| 🟠 P2 | Trava de Edição 3 dias | 2h |
| 🟠 P2 | Produto Duplicado | 30min |
| 🟠 P2 | Backup (Google Drive + Email) | 3-4h |
| 🟡 P3 | Módulo Contabilidade | 15-20h |
| 🟡 P3 | Importador iFood | 20-25h |
| 🟡 P3 | Outras Receitas | 8-10h |
| 🟡 P3 | Catálogo Digital (API) | 4-6h |
| 🟡 P3 | Histórico de Preço | 6-8h |
| 🟡 P3 | API WhatsApp | 8-10h |
| 🟡 P3 | Auditoria | 10-12h |
| 🟢 P4 | Ajustes Fechamento | 3-4h |
| 🟢 P4 | Melhorias Análises | 4-5h |
| 🟢 P4 | Card Crédito Dashboard | 2h |
| 🟢 P4 | Tela de Metas (visual) | 4-6h |
| 🟢 P4 | Livro (Documentação) | 15-20h |
| 🔵 P5 | Acesso por Empresa (Multi-tenant) | 40-60h |

**Total estimado:** ~155-200 horas

---

## 🔄 SUGESTÃO DE ORDEM DE EXECUÇÃO (ATUALIZADA)

1. **Sprint 1 (Bugs Críticos):** BUG-01, BUG-02, Produto Duplicado, Backup (~10h)
2. **Sprint 2 (Integridade):** Trava de Edição, Alterar Cliente, BUG-03 (~8h)
3. **Sprint 3 (Rastreabilidade):** Histórico de Preço, Auditoria (~18h)
4. **Sprint 4 (Fechamento/Análises):** Ajustes Fechamento, Melhorias Análises, Metas (~12h)
5. **Sprint 5 (Contabilidade):** Módulo Contabilidade completo (~20h)
6. **Sprint 6 (Integrações):** Catálogo Digital, API WhatsApp (~15h)
7. **Sprint 7 (iFood):** Importador iFood (~25h)
8. **Sprint 8 (Receitas/Dashboard):** Outras Receitas, Card Crédito (~12h)
9. **Sprint 9 (Documentação):** Livro completo (~20h)
10. **Sprint 10 (Futuro):** Acesso por Empresa (~50h)

---

**Aguardo revisão do Orion antes de iniciar implementação.**
