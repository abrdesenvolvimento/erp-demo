# Respostas Técnicas: Implementação do Plano Contábil

**Data:** 15 de janeiro de 2026  
**Assunto:** Esclarecimentos sobre arquitetura do plano contábil/gerencial  
**Status:** Pronto para implementação

---

## Ponto 1: Aplicar Plano Apenas a Partir de Janeiro 2026

### Situação Atual
Você tem dados históricos (até dezembro 2025) que não serão reclassificados. Novo plano começa em janeiro 2026.

### Recomendação Técnica: ✅ IMPLEMENTAR ASSIM

**Abordagem:**
1. Manter dados históricos como estão (sem alterações)
2. Adicionar campo `accountingCode` às tabelas de transações (expenses, sales, purchases)
3. Deixar `accountingCode = NULL` para transações anteriores a janeiro 2026
4. Tornar `accountingCode` obrigatório para transações a partir de janeiro 2026

**Implementação no Schema:**

```typescript
// Adicionar aos expenses, sales, purchaseOrders, etc.
accountingCode: varchar("accountingCode", { length: 20 }),  // 3.1.01.001
accountingMappingDate: timestamp("accountingMappingDate"),  // Data quando foi mapeado

// Criar índice para queries de DRE
accountingIdx: index("accounting_idx").on(table.accountingCode)
```

**Benefícios:**
- ✅ Sem risco de corromper dados históricos
- ✅ Possibilidade de comparar dois períodos com metodologias diferentes
- ✅ Fácil auditoria (sabe exatamente quando mudou)

**Queries de DRE:**
```sql
-- DRE apenas de 2026
SELECT 
  am.accountingName,
  SUM(e.amount) as valor
FROM expenses e
JOIN accountingMappings am ON e.accountingCode = am.accountingCode
WHERE YEAR(e.createdAt) = 2026
GROUP BY e.accountingCode;
```

---

## Ponto 2: Receitas por Tipo (Balcão / A Prazo / Delivery)

### Situação Atual
Você tem 3 canais de venda: Balcão, A Prazo, Delivery. Quer agrupar em 3 contas contábeis, não por canal individual.

### Recomendação Técnica: ✅ IMPLEMENTAR ASSIM

**Estrutura Contábil Proposta:**

```
3.4.01.001 - Receita de Vendas - Balcão
3.4.01.002 - Receita de Vendas - A Prazo
3.4.01.003 - Receita de Vendas - Delivery
```

**Mapeamento no Sistema:**

```typescript
// Tabela: revenueAccounts (Nova)
export const revenueAccounts = mysqlTable("revenueAccounts", {
  id: int("id").primaryKey().autoincrement(),
  accountingCode: varchar("accountingCode", { length: 20 }).notNull(),  // 3.4.01.001
  salesChannelId: int("salesChannelId").notNull(),  // FK para salesChannels
  description: varchar("description", { length: 100 }),  // "Receita de Vendas - Balcão"
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  channelIdx: index("channel_idx").on(table.salesChannelId),
  codeIdx: index("code_idx").on(table.accountingCode),
}));
```

**Fluxo de Integração:**

```
Venda criada
  ↓
Buscar salesChannelId (Balcão/A Prazo/Delivery)
  ↓
Buscar revenueAccounts.accountingCode correspondente
  ↓
Registrar accountingCode na tabela sales
  ↓
Usar para gerar DRE
```

**Implementação no Endpoint de Vendas:**

```typescript
// server/routers.ts - Ao criar venda
const revenueAccount = await db
  .select()
  .from(revenueAccounts)
  .where(eq(revenueAccounts.salesChannelId, input.channelId))
  .limit(1);

const sale = await db.insert(sales).values({
  ...input,
  accountingCode: revenueAccount[0].accountingCode,  // Automático!
});
```

**Benefícios:**
- ✅ Automático: não precisa digitar código contábil
- ✅ Flexível: fácil adicionar novos canais
- ✅ Auditável: rastreia qual canal gerou qual receita

---

## Ponto 3: Conta de Empréstimo - Necessário Criar?

### Análise Técnica

**Resposta: SIM, é recomendado criar.**

**Por quê?** Porque empréstimos são **passivos** (dívidas), não despesas. Se você trata como despesa, o resultado fica incorreto.

**Exemplo do Problema:**
```
Sem conta de empréstimo:
  Receita: R$ 10.000
  Despesas: R$ 3.000
  Empréstimo recebido: R$ 5.000 (registrado como receita? despesa? ❌ Confuso)
  Resultado: Incorreto

Com conta de empréstimo:
  Receita: R$ 10.000
  Despesas: R$ 3.000
  Resultado Operacional: R$ 7.000  ✅ Correto
  (Empréstimo fica no Balanço Patrimonial, não no DRE)
```

### Estrutura Proposta

**Adicionar ao Plano Contábil:**

```
2.2.01.001 - Empréstimos Bancários (Passivo Circulante)
2.2.01.002 - Empréstimos de Sócios (Passivo Circulante)
2.2.02.001 - Financiamentos (Passivo Não Circulante)

3.6.01.001 - Juros de Empréstimos (Despesa Financeira)
```

**Tabela no Sistema:**

```typescript
// Tabela: loans (Nova)
export const loans = mysqlTable("loans", {
  id: int("id").primaryKey().autoincrement(),
  description: varchar("description", { length: 100 }).notNull(),  // "Empréstimo Banco X"
  loanType: mysqlEnum("loanType", ["BANCARIO", "SOCIO", "FINANCIAMENTO"]),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  startDate: timestamp("startDate").notNull(),
  dueDate: timestamp("dueDate"),
  interestRate: decimal("interestRate", { precision: 5, scale: 2 }),  // 5.5% ao mês
  status: mysqlEnum("status", ["ATIVO", "QUITADO", "CANCELADO"]),
  accountingCode: varchar("accountingCode", { length: 20 }).notNull(),  // 2.2.01.001
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

// Tabela: loanPayments (Nova)
export const loanPayments = mysqlTable("loanPayments", {
  id: int("id").primaryKey().autoincrement(),
  loanId: int("loanId").notNull(),
  paymentDate: timestamp("paymentDate").notNull(),
  principalAmount: decimal("principalAmount", { precision: 12, scale: 2 }).notNull(),
  interestAmount: decimal("interestAmount", { precision: 12, scale: 2 }).notNull(),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  accountingCodePrincipal: varchar("accountingCodePrincipal", { length: 20 }),  // 2.2.01.001
  accountingCodeInterest: varchar("accountingCodeInterest", { length: 20 }),    // 3.6.01.001
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
});
```

**Benefícios:**
- ✅ DRE correto (juros como despesa, principal como passivo)
- ✅ Balanço Patrimonial correto (empréstimo como dívida)
- ✅ Rastreamento de juros acumulados
- ✅ Controle de vencimentos

**Recomendação:** Sim, crie a conta de empréstimo. Não é complexo e melhora muito a precisão financeira.

---

## Ponto 4: Outras Receitas - Módulo Novo ou Reutilizar Existente?

### Situação Atual
Hoje você só tem receita de vendas. Outras receitas (juros, aluguel de espaço, etc.) são lançadas como débito em "Contas a Receber".

### Análise das Opções

| Opção | Prós | Contras |
|-------|------|---------|
| **Criar Módulo "Receitas"** | Estruturado, auditável, flexível | +20h desenvolvimento |
| **Reutilizar Contas a Receber** | Rápido, usa estrutura existente | Confunde receita com cliente |
| **Usar Despesas (inverter)** | Muito rápido | Muito confuso, errado |

### Recomendação Técnica: ✅ REUTILIZAR CONTAS A RECEBER (Curto Prazo)

**Por quê?** Porque você disse "não temos a possibilidade de lançar outras receitas". Isso significa que não é prioridade agora.

**Como Implementar:**

Adicionar um campo à tabela `receivables` para distinguir:

```typescript
// Modificar receivables
export const receivables = mysqlTable("receivables", {
  // ... campos existentes ...
  saleId: int("saleId"),  // NULL para receitas que não são vendas
  receiptType: mysqlEnum("receiptType", [
    "VENDA",           // Venda normal
    "JUROS",           // Juros recebidos
    "ALUGUEL",         // Aluguel de espaço
    "DEVOLUCAO",       // Devolução de cliente
    "OUTRA"            // Outra receita
  ]).default("VENDA"),
  accountingCode: varchar("accountingCode", { length: 20 }),  // 3.6.01.001 para juros
  // ... resto dos campos ...
});
```

**Fluxo:**

```
Para Receita de Venda (Atual):
  Venda criada → receivables criado com receiptType = "VENDA", saleId = 123

Para Outra Receita (Novo):
  Usuário clica "Lançar Juros" → Cria receivables com receiptType = "JUROS", saleId = NULL, accountingCode = "3.6.01.001"
```

**Benefícios:**
- ✅ Usa estrutura existente (sem novo módulo)
- ✅ Rápido de implementar (2-3 horas)
- ✅ Funciona para 80% dos casos
- ✅ Fácil migrar para módulo dedicado depois

### Evolução Futura: Criar Módulo Dedicado

Quando você tiver mais tipos de receita, cria um módulo `revenueTransactions`:

```typescript
export const revenueTransactions = mysqlTable("revenueTransactions", {
  id: int("id").primaryKey().autoincrement(),
  type: mysqlEnum("type", ["JUROS", "ALUGUEL", "CONSULTORIA", "DEVOLUCAO"]),
  description: varchar("description", { length: 255 }),
  amount: decimal("amount", { precision: 12, scale: 2 }),
  transactionDate: timestamp("transactionDate"),
  accountingCode: varchar("accountingCode", { length: 20 }),
  status: mysqlEnum("status", ["PENDENTE", "RECEBIDO"]),
  createdAt: timestamp("createdAt").defaultNow(),
});
```

**Recomendação:** Comece reutilizando `receivables`. Quando tiver 3+ tipos de receita, cria módulo dedicado.

---

## Ponto 5: Contas Patrimoniais - Módulo Novo ou Reutilizar?

### Situação Atual
Você tem tabelas de:
- Caixa/Bancos: Não existe (apenas pagamentos)
- Contas a Receber: ✅ Existe (`receivables`)
- Contas a Pagar: ✅ Existe (`accountsPayable`)
- Estoque: ✅ Existe (`products` com `currentStock`)
- Empréstimos: ❌ Não existe

### Análise: O que Reutilizar vs. Criar

| Conta Patrimonial | Estrutura Atual | Recomendação |
|------------------|-----------------|--------------|
| **Caixa** | Não existe | ⚠️ Criar tabela `cashMovements` |
| **Bancos** | Não existe | ⚠️ Criar tabela `bankAccounts` |
| **Contas a Receber** | ✅ `receivables` | ✅ Reutilizar |
| **Estoque** | ✅ `products` | ✅ Reutilizar |
| **Contas a Pagar** | ✅ `accountsPayable` | ✅ Reutilizar |
| **Empréstimos** | ❌ Não existe | ⚠️ Criar tabela `loans` |
| **Patrimônio Líquido** | Não existe | ⚠️ Criar tabela `equityMovements` |

### Recomendação Técnica: ✅ REUTILIZAR + CRIAR O MÍNIMO NECESSÁRIO

**Não crie um "módulo patrimonial" genérico.** Em vez disso, crie tabelas específicas conforme necessário:

**Fase 1 (Imediato - Reutilizar):**
```
Ativo Circulante:
  ├─ Contas a Receber: Usar receivables ✅
  └─ Estoque: Usar products.currentStock ✅

Passivo Circulante:
  ├─ Contas a Pagar: Usar accountsPayable ✅
  └─ Empréstimos: Criar loans (Ponto 3)
```

**Fase 2 (Próximas 2-3 semanas - Criar o Mínimo):**

```typescript
// Tabela: cashMovements (Nova)
// Para rastrear caixa físico
export const cashMovements = mysqlTable("cashMovements", {
  id: int("id").primaryKey().autoincrement(),
  movementDate: timestamp("movementDate").notNull(),
  type: mysqlEnum("type", ["ENTRADA", "SAIDA"]),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: varchar("description", { length: 255 }),
  source: mysqlEnum("source", [
    "VENDA_BALCAO",
    "RECEBIMENTO_CLIENTE",
    "PAGAMENTO_FORNECEDOR",
    "DESPESA",
    "OUTRO"
  ]),
  accountingCode: varchar("accountingCode", { length: 20 }),  // 1.1.01.001
  createdAt: timestamp("createdAt").defaultNow(),
});

// Tabela: bankAccounts (Nova)
// Para rastrear contas bancárias
export const bankAccounts = mysqlTable("bankAccounts", {
  id: int("id").primaryKey().autoincrement(),
  bankName: varchar("bankName", { length: 100 }).notNull(),  // "Banco do Brasil"
  accountNumber: varchar("accountNumber", { length: 50 }).notNull(),
  accountType: mysqlEnum("accountType", ["CORRENTE", "POUPANCA"]),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull(),
  accountingCode: varchar("accountingCode", { length: 20 }).notNull(),  // 1.1.01.002
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

// Tabela: bankMovements (Nova)
// Para rastrear transações bancárias
export const bankMovements = mysqlTable("bankMovements", {
  id: int("id").primaryKey().autoincrement(),
  bankAccountId: int("bankAccountId").notNull(),
  movementDate: timestamp("movementDate").notNull(),
  type: mysqlEnum("type", ["DEPOSITO", "SAQUE", "TRANSFERENCIA", "JUROS", "TAXA"]),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: varchar("description", { length: 255 }),
  referenceId: varchar("referenceId", { length: 100 }),  // ID da venda, compra, etc.
  accountingCode: varchar("accountingCode", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow(),
});
```

**Benefícios:**
- ✅ Usa estrutura existente (receivables, accountsPayable, products)
- ✅ Cria apenas o necessário (cash, bank, loans)
- ✅ Sem "módulo patrimonial" genérico e confuso
- ✅ Fácil de manter e expandir

### Balanço Patrimonial - Como Gerar?

Você **não precisa de um módulo especial**. Gera via queries:

```sql
-- BALANÇO PATRIMONIAL - 31/01/2026

-- ATIVO CIRCULANTE
SELECT 
  '1.1.01.001' as code,
  'Caixa' as account,
  COALESCE(SUM(amount), 0) as value
FROM cashMovements
WHERE movementDate <= '2026-01-31'
  AND type = 'ENTRADA'
UNION ALL
SELECT 
  '1.1.01.002',
  'Bancos',
  SUM(balance)
FROM bankAccounts
WHERE isActive = 1
UNION ALL
SELECT 
  '1.2.01.001',
  'Contas a Receber',
  SUM(totalAmount - receivedAmount)
FROM receivables
WHERE status IN ('PENDENTE', 'PARCIAL', 'VENCIDO')
  AND createdAt <= '2026-01-31'
UNION ALL
SELECT 
  '1.3.01.001',
  'Estoque',
  SUM(currentStock * avgCost)
FROM products
WHERE active = 1;
```

**Recomendação:** Não crie módulo patrimonial agora. Crie as tabelas específicas (cash, bank, loans) conforme necessário. Gere balanço via queries SQL.

---

## Resumo Executivo - Próximos Passos

### ✅ O que Fazer Agora (Semana 1)

1. **Ponto 1 (Data de Início):** Adicionar `accountingCode` às tabelas de transações
2. **Ponto 2 (Receitas por Tipo):** Criar tabela `revenueAccounts` e mapear 3 canais
3. **Ponto 3 (Empréstimos):** Criar tabelas `loans` e `loanPayments`
4. **Ponto 4 (Outras Receitas):** Modificar `receivables` com campo `receiptType`
5. **Ponto 5 (Patrimonial):** Criar tabelas `cashMovements` e `bankAccounts`

### ⏳ O que Fazer Depois (Semana 2-3)

1. Implementar endpoints para registrar transações com `accountingCode`
2. Criar queries para gerar DRE completo
3. Criar queries para gerar Balanço Patrimonial
4. Implementar UI para lançar receitas e empréstimos

### 📊 Resultado Final

Um DRE completo e correto:
```
Receita Bruta:                    R$ 50.000
(-) Deduções:                    (R$ 2.000)
= Receita Líquida:                R$ 48.000

(-) Custos Operacionais:         (R$ 15.000)
= Lucro Bruto:                    R$ 33.000

(-) Despesas Operacionais:       (R$ 8.000)
(-) Despesas Administrativas:    (R$ 5.000)
(-) Despesas Financeiras:        (R$ 1.000)
= Resultado Operacional:          R$ 19.000
```

---

## Próxima Ação

**Você confirma que quer implementar assim?** Se sim, posso começar hoje mesmo com:
1. Criar as 5 tabelas novas
2. Adicionar campos de `accountingCode` às tabelas existentes
3. Implementar endpoints para registrar transações

---

**Documento preparado por:** Manus AI  
**Data:** 15 de janeiro de 2026  
**Esforço Estimado:** 40 horas (2 semanas)  
**Risco:** Baixo (usa estrutura existente)
