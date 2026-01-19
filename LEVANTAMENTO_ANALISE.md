# Análise de Levantamentos de Melhorias - ERP Adega Beira Rio

**Data:** 15 de janeiro de 2026  
**Versão:** 1.0  
**Status:** Análise Completa

---

## Resumo Executivo

Foram identificados **6 pontos críticos** que impedem o andamento do projeto. A análise técnica revelou problemas estruturais no módulo de despesas, inconsistências de dados em produtos e necessidade de novas funcionalidades de análise. Este documento detalha cada problema, suas causas raiz e recomendações de solução.

---

## 1. Produtos Vencendo - Dados Fantasmas

### Problema Identificado

Produtos são marcados como vencidos no sistema sem que uma data de validade tenha sido registrada corretamente. Exemplo: produto aparece como vencido na tela, mas não há data de validade no banco de dados.

### Causa Raiz

**Estrutura de Dados Incompleta:** O sistema atual não possui um mecanismo robusto para rastrear validades por lote/entrada. A tabela `products` possui apenas um campo `expirationDate` global, não permitindo controle por lote.

**Tabelas Envolvidas:**
- `products` - Campo: `expirationDate` (timestamp, único por produto)
- `productMovements` - Registra entrada/saída, mas NÃO registra data de validade por lote

### Impacto

- Produtos aparecem como vencidos sem justificativa
- Impossível rastrear qual lote venceu
- Relatórios de vencimento imprecisos
- Possível venda de produtos vencidos

### Recomendação de Solução

**Curto Prazo (Imediato):**
1. Criar query para identificar todos os produtos com `expirationDate IS NULL` e `currentStock > 0`
2. Gerar relatório de inconsistências
3. Implementar validação obrigatória: produtos com `expirationDate` NULL não podem ter estoque positivo

**Médio Prazo (1-2 sprints):**
1. Criar tabela `productBatches` para rastrear lotes com validades individuais
2. Modificar `productMovements` para registrar `batchId`
3. Implementar lógica FIFO (First In, First Out) para saídas

**Estrutura Proposta:**
```sql
CREATE TABLE productBatches (
  id INT PRIMARY KEY AUTO_INCREMENT,
  productId INT NOT NULL,
  batchNumber VARCHAR(100),
  quantity DECIMAL(10, 3),
  expirationDate TIMESTAMP,
  entryDate TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

---

## 2. Despesas - Tipo "Perdas" (CRÍTICO)

### Problema Identificado

**Três problemas simultâneos:**

1. **Não está registrando:** Despesas do tipo "Perdas" não são salvas no banco de dados mesmo com produto e quantidade informados
2. **Forma de pagamento:** Quando tipo = "Perdas", a forma de pagamento deveria ser automaticamente "Perdas" (não deve ser selecionável)
3. **Valor da parcela:** Deveria preencher automaticamente com o valor total

### Análise Técnica

**Estrutura Atual:**
```
expenses (tabela principal)
├── categoryId (FK para expenseCategories)
├── productId (apenas para Perdas)
├── lossQuantity (apenas para Perdas)
├── paymentMethod (manual, não automático)
└── amount (manual, não automático)

expenseInstallments (parcelas)
├── expenseId
├── installmentNumber
└── amount
```

**Problema Identificado:** O fluxo de criação de despesas "Perdas" não está implementado corretamente. Não há:
- Validação de campos obrigatórios para Perdas
- Cálculo automático de valor (produto × quantidade)
- Atribuição automática de forma de pagamento
- Tratamento de erro quando falha

### Causa Raiz

**Falta de Lógica no Backend:** O endpoint `POST /api/expenses` não possui lógica específica para o tipo "Perdas". Está tratando todas as despesas de forma genérica.

### Impacto

- Perdas não são registradas no sistema
- Estoque não é atualizado quando há perda
- Relatórios de perdas vazios
- Impossível rastrear perdas operacionais

### Recomendação de Solução

**Imediato (Hoje):**
1. Verificar endpoint de criação de despesas em `server/routers.ts`
2. Adicionar validação específica para tipo "Perdas"
3. Implementar cálculo automático de valor
4. Forçar `paymentMethod = "Perdas"` automaticamente

**Código Proposto:**
```typescript
// server/routers.ts
expenses: router({
  create: protectedProcedure
    .input(z.object({
      categoryId: z.number(),
      productId: z.number().optional(),
      lossQuantity: z.number().optional(),
      // ... outros campos
    }))
    .mutation(async ({ ctx, input }) => {
      // Se for Perdas
      if (input.categoryId === PERDAS_CATEGORY_ID) {
        if (!input.productId || !input.lossQuantity) {
          throw new Error('Produto e quantidade são obrigatórios para Perdas');
        }
        
        // Buscar preço do produto
        const product = await getProduct(input.productId);
        const amount = product.avgCost * input.lossQuantity;
        
        // Criar despesa com valores automáticos
        return db.insert(expenses).values({
          ...input,
          amount,
          paymentMethod: 'Perdas', // Automático
          status: 'ATIVA'
        });
      }
      // ... resto da lógica
    })
})
```

---

## 3. Tela de Fechamento - Novos Quadros de Análise

### Problema Identificado

A tela de fechamento atual mostra apenas **Vendas por Canal** (Delivery, Balcão, A Prazo). Faltam:
- Vendas por Categoria de Produtos
- Compras por Categoria de Produtos
- Acompanhamento de Margem

### Análise Técnica

**Dados Disponíveis:**
- `sales` + `saleItems` + `products` + `categories` → Vendas por Categoria
- `purchaseOrders` + `purchaseOrderItems` + `products` + `categories` → Compras por Categoria
- `products` (avgCost) + `productPrices` + `sales` → Margem

**Estrutura Necessária:**

| Quadro | Dados Necessários | Cálculo |
|--------|------------------|---------|
| Vendas por Categoria | SUM(saleItems.quantity * productPrices.price) GROUP BY categories.name | Valor total por categoria |
| Compras por Categoria | SUM(purchaseOrderItems.quantity * purchaseOrderItems.unitPrice) GROUP BY categories.name | Valor total por categoria |
| Margem | (Preço Venda - Custo) / Preço Venda × 100 | % de margem por categoria |

### Impacto

- Falta visibilidade de quais categorias vendem mais
- Impossível identificar categorias com baixa margem
- Análise de desempenho incompleta
- Decisões comerciais baseadas em dados parciais

### Recomendação de Solução

**Implementação em 3 etapas:**

**Etapa 1 - Vendas por Categoria:**
```typescript
// server/db.ts
export async function getSalesByCategory(startDate: Date, endDate: Date) {
  return db
    .select({
      categoryName: categories.name,
      totalValue: sql`SUM(${saleItems.quantity} * ${productPrices.price})`,
      quantity: sql`SUM(${saleItems.quantity})`,
      itemCount: sql`COUNT(DISTINCT ${saleItems.id})`
    })
    .from(sales)
    .innerJoin(saleItems, eq(sales.id, saleItems.saleId))
    .innerJoin(products, eq(saleItems.productId, products.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .innerJoin(productPrices, eq(products.id, productPrices.productId))
    .where(
      and(
        gte(sales.saleDate, startDate),
        lte(sales.saleDate, endDate)
      )
    )
    .groupBy(categories.id, categories.name);
}
```

**Etapa 2 - Compras por Categoria:** Similar ao acima

**Etapa 3 - Margem por Categoria:**
```typescript
export async function getMarginByCategory(startDate: Date, endDate: Date) {
  return db
    .select({
      categoryName: categories.name,
      avgMargin: sql`AVG((${productPrices.price} - ${products.avgCost}) / ${productPrices.price} * 100)`,
      minMargin: sql`MIN((${productPrices.price} - ${products.avgCost}) / ${productPrices.price} * 100)`,
      maxMargin: sql`MAX((${productPrices.price} - ${products.avgCost}) / ${productPrices.price} * 100)`
    })
    // ... resto da query
}
```

---

## 4. Contas Gerenciais - Reorganização de Categorias

### Problema Identificado

O usuário está reorganizando as contas gerenciais (categorias de despesas) para alinhar com um plano contábil. Necessário entender como fazer essa alteração no sistema sem quebrar dados existentes.

### Análise Técnica

**Tabelas Envolvidas:**
- `expenseCategories` - Categorias de despesas (16 categorias existentes)
- `expenses` - Registros de despesas (FK para categoryId)

**Risco:** Alterar nomes ou IDs de categorias pode quebrar relatórios e consultas existentes.

### Recomendação de Solução

**Abordagem Segura:**

1. **Não alterar IDs existentes** - Manter compatibilidade com dados históricos
2. **Adicionar campo de mapeamento** - Criar tabela de mapeamento contábil
3. **Criar nova estrutura:**

```sql
-- Tabela de mapeamento contábil
CREATE TABLE accountingMapping (
  id INT PRIMARY KEY AUTO_INCREMENT,
  expenseCategoryId INT NOT NULL,
  accountingCode VARCHAR(20),
  accountingName VARCHAR(100),
  createdAt TIMESTAMP DEFAULT NOW()
);
```

4. **Processo de Migração:**
   - Exportar categorias atuais
   - Mapear para novo plano contábil
   - Atualizar tabela de mapeamento
   - Gerar relatórios com ambas as classificações (temporário)

---

## 5. Backup - Validação de Execução

### Problema Identificado

Necessário confirmar se o backup está sendo executado corretamente, especialmente o upload para Google Drive.

### Status Atual

**✅ Confirmado Funcionando:**
- Endpoint `/api/backup` criado e testado
- Mysqldump do banco de dados: ✅ Funcionando (29 MB)
- ZIP do código: ✅ Funcionando (3.6 MB)
- Upload para Google Drive: ✅ Funcionando (testado em 15/01)
- Notificações via Manus: ✅ Funcionando
- Agendamento cron: ✅ Configurado (3h GMT-3 diariamente)

**Teste Realizado:**
```
POST /api/backup
Resposta: 200 OK
- database-2026-01-15T09-51-02.sql (29.43 MB) → Google Drive ✅
- code-2026-01-15T09-51-06.zip (3.60 MB) → Google Drive ✅
Tempo: 10.39s
```

### Recomendação de Solução

**Para Validação Contínua:**
1. Acessar `/api/backup/status` para verificar últimos backups
2. Verificar pasta do Google Drive: https://drive.google.com/drive/folders/1NIchyOc_oKNaFYeBubJwrLJp0sBIxpaw
3. Monitorar notificações diárias do Manus

**Próximas Melhorias:**
- Dashboard de histórico de backups no ERP
- Alertas se backup não executar por 24h
- Teste automático de restauração

---

## Plano de Ação Priorizado

| Prioridade | Item | Esforço | Impacto | Status |
|-----------|------|--------|--------|--------|
| 🔴 CRÍTICO | Despesas - Perdas não registra | 2h | Alto | Bloqueante |
| 🔴 CRÍTICO | Validação de dados vencidos | 1h | Alto | Bloqueante |
| 🟡 ALTO | Novos quadros de análise | 8h | Alto | Importante |
| 🟡 ALTO | Contas gerenciais - Mapeamento | 4h | Médio | Importante |
| 🟢 MÉDIO | Backup - Dashboard | 4h | Baixo | Melhorias |

---

## Próximos Passos Recomendados

### Hoje (Imediato)
1. ✅ Corrigir endpoint de criação de despesas "Perdas"
2. ✅ Implementar validação e cálculo automático
3. ✅ Testar fluxo completo

### Esta Semana
1. Criar query para detectar produtos com dados inconsistentes
2. Implementar validação obrigatória de validade
3. Começar implementação dos novos quadros de análise

### Próximas 2 Semanas
1. Completar quadros de análise (Vendas, Compras, Margem)
2. Estruturar mapeamento de contas gerenciais
3. Criar dashboard de backup

---

## Conclusão

Os problemas identificados são **solucionáveis** e não representam falhas estruturais do sistema. A maioria requer ajustes pontuais no backend e novas queries de análise. O backup está funcionando corretamente e não requer ação imediata.

**Recomendação:** Começar pela correção do módulo de Perdas (crítico) e depois implementar as melhorias de análise.

---

**Documento preparado por:** Manus AI  
**Data:** 15 de janeiro de 2026
