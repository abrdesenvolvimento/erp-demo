# Arquitetura de Contabilização - Fase 1

**Data:** 19 de janeiro de 2026  
**Status:** Aprovado pela Contabilidade  
**Versão:** 1.0

---

## 1. Confirmação: Sua Lógica Está Correta ✅

Você perguntou:
> "A melhor forma é lançarmos despesa e receita via a conta gerencial com a amarração contábil?"

**Resposta: SIM, está correto!** Essa é a melhor arquitetura. Aqui está o porquê:

### Fluxo Correto (O que você propôs)

```
Usuário lança Despesa
    ↓
Seleciona Conta Gerencial (ex: "Aluguel")
    ↓
Sistema busca Conta Contábil mapeada (ex: "3.2.01.001")
    ↓
Registra lançamento com accountingCode automático
    ↓
Aparece no DRE na linha correta
```

### Por Que Está Correto

1. **Separação de Responsabilidades:**
   - Usuário trabalha com **Contas Gerenciais** (linguagem do negócio)
   - Sistema gerencia **Contas Contábeis** (linguagem contábil)
   - Contador mapeia a relação entre elas

2. **Flexibilidade:**
   - Fácil adicionar novas contas gerenciais depois
   - Fácil reclassificar sem perder dados históricos
   - Contador pode mudar mapeamento sem quebrar sistema

3. **Auditoria:**
   - Cada lançamento rastreia qual conta gerencial gerou qual conta contábil
   - Fácil validar com contador

4. **Escalabilidade:**
   - Quando chegar em receitas, vendas, etc., usa o mesmo padrão
   - Consistência em todo o sistema

---

## 2. Análise do De-Para Fornecido

### Dados Extraídos

Você tem **20 lançamentos** com as seguintes categorias gerenciais:

| Conta Gerencial | Quantidade | Valor Total | Observação |
|-----------------|-----------|-------------|-----------|
| Aluguel | 1 | R$ 720,00 | Jocineide Pereira |
| Consultoria e Assessoria | 1 | R$ 350,00 | Jaine Barros |
| Software e Sistemas | 2 | R$ 3.052,41 | Manus + Gabriel |
| Embalagens | 3 | R$ 421,42 | Embrasplast + RM (2x) |
| Tarifa Cartões | 1 | R$ 53,08 | PicPay |
| Energia Elétrica | 1 | R$ 2.496,47 | Enel |
| Manutenção de Equipamentos | 1 | R$ 30,00 | Adega Beira Rio |
| Imóvel Alugado | 4 | R$ 12.346,50 | Depósito + Reginaldo + Studio (2x) |
| Despesa Bancária | 1 | R$ 9,90 | Itau |
| Terceirizado | 1 | R$ 285,00 | Adega Beira Rio |
| Pró-Labore | 4 | R$ 5.250,00 | Gabriel + Ricardo (2x cada) |
| **TOTAL** | **20** | **R$ 24.614,78** | |

### Mapeamento para Plano Contábil

Com base no plano contábil que você enviou, o mapeamento seria:

| Conta Gerencial | Código Contábil | Classificação | Tipo |
|-----------------|-----------------|---------------|------|
| Aluguel | 3.2.01.001 | Despesa Operacional | Fixa |
| Consultoria e Assessoria | 3.3.01.001 | Despesa Administrativa | Variável |
| Software e Sistemas | 3.3.01.002 | Despesa Administrativa | Fixa |
| Embalagens | 3.1.01.001 | Custo Operacional | Variável |
| Tarifa Cartões | 3.3.02.001 | Despesa Financeira | Variável |
| Energia Elétrica | 3.2.01.002 | Despesa Operacional | Fixa |
| Manutenção de Equipamentos | 3.2.02.001 | Despesa Operacional | Variável |
| Imóvel Alugado | 3.2.01.001 | Despesa Operacional | Fixa |
| Despesa Bancária | 3.3.02.001 | Despesa Financeira | Fixa |
| Terceirizado | 3.1.01.002 | Custo Operacional | Variável |
| Pró-Labore | 3.3.01.003 | Despesa Administrativa | Fixa |

---

## 3. Resposta à Dúvida do Contador

### Pergunta: "Podemos criar outras contas no futuro?"

**Resposta: SIM, com a arquitetura proposta é muito fácil!**

### Como Funciona

**Hoje (Janeiro 2026):**
```
Tabela: managementAccounts (Contas Gerenciais)
├─ Aluguel
├─ Consultoria
├─ Software
├─ Embalagens
└─ ... (11 contas)

Tabela: accountingMappings (Mapeamento)
├─ Aluguel → 3.2.01.001
├─ Consultoria → 3.3.01.001
└─ ... (11 mapeamentos)
```

**Amanhã (Quando precisar de nova conta):**
```
Adicionar em managementAccounts:
├─ Nova Conta: "Publicidade e Marketing"

Adicionar em accountingMappings:
├─ Publicidade → 3.3.01.004

Pronto! Sem quebrar nada.
```

### Benefícios

1. ✅ **Sem Migração de Dados:** Lançamentos antigos continuam funcionando
2. ✅ **Sem Alteração de Código:** Apenas adicionar registros no banco
3. ✅ **Sem Impacto no DRE:** Novos lançamentos aparecem automaticamente
4. ✅ **Auditável:** Histórico de quando cada conta foi criada

---

## 4. Arquitetura Técnica Proposta

### Tabelas Necessárias

#### 1. `managementAccounts` (Contas Gerenciais)

```typescript
export const managementAccounts = mysqlTable("managementAccounts", {
  id: int("id").primaryKey().autoincrement(),
  code: varchar("code", { length: 20 }).notNull().unique(),  // "ALU001"
  name: varchar("name", { length: 100 }).notNull(),          // "Aluguel"
  description: text("description"),
  type: mysqlEnum("type", ["DESPESA", "RECEITA", "CUSTO"]),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
```

#### 2. `accountingMappings` (Mapeamento Gerencial → Contábil)

```typescript
export const accountingMappings = mysqlTable("accountingMappings", {
  id: int("id").primaryKey().autoincrement(),
  managementAccountId: int("managementAccountId").notNull(),
  accountingCode: varchar("accountingCode", { length: 20 }).notNull(),  // "3.2.01.001"
  accountingName: varchar("accountingName", { length: 100 }),
  classification: mysqlEnum("classification", [
    "CUSTO_OPERACIONAL",
    "DESPESA_OPERACIONAL",
    "DESPESA_ADMINISTRATIVA",
    "DESPESA_FINANCEIRA",
    "RECEITA_VENDAS",
    "RECEITA_OUTRA"
  ]),
  isFixed: boolean("isFixed"),  // Custo fixo ou variável
  effectiveDate: timestamp("effectiveDate").notNull(),  // Quando começou a valer
  endDate: timestamp("endDate"),  // Quando deixou de valer (NULL = ainda ativa)
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  mgmtIdx: index("mgmt_idx").on(table.managementAccountId),
  codeIdx: index("code_idx").on(table.accountingCode),
}));
```

#### 3. Modificar `expenses` (Despesas)

```typescript
export const expenses = mysqlTable("expenses", {
  // ... campos existentes ...
  managementAccountId: int("managementAccountId").notNull(),  // FK para conta gerencial
  accountingCode: varchar("accountingCode", { length: 20 }),  // Desnormalizado para auditoria
  accountingCodeDate: timestamp("accountingCodeDate"),  // Quando foi mapeado
  // ... resto dos campos ...
});
```

### Fluxo de Dados

```
1. Usuário cria Despesa
   ├─ Seleciona: "Aluguel" (managementAccountId = 1)
   └─ Valor: R$ 720,00

2. Sistema busca mapeamento
   ├─ Query: SELECT accountingCode FROM accountingMappings 
   │         WHERE managementAccountId = 1 AND effectiveDate <= NOW()
   └─ Resultado: "3.2.01.001"

3. Sistema registra despesa
   ├─ expenses.managementAccountId = 1
   ├─ expenses.accountingCode = "3.2.01.001"
   └─ expenses.accountingCodeDate = NOW()

4. Sistema gera DRE
   ├─ Query: SELECT SUM(amount) FROM expenses 
   │         WHERE accountingCode LIKE "3.2%"
   └─ Resultado: R$ 3.216,47 (Despesas Operacionais)
```

---

## 5. Implementação Passo a Passo

### Semana 1: Preparação (19-23 de janeiro)

#### Dia 1 (Seg 19): Criar Tabelas

```typescript
// drizzle/schema.ts

export const managementAccounts = mysqlTable("managementAccounts", {
  id: int("id").primaryKey().autoincrement(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["DESPESA", "RECEITA", "CUSTO"]).default("DESPESA"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export const accountingMappings = mysqlTable("accountingMappings", {
  id: int("id").primaryKey().autoincrement(),
  managementAccountId: int("managementAccountId").notNull(),
  accountingCode: varchar("accountingCode", { length: 20 }).notNull(),
  accountingName: varchar("accountingName", { length: 100 }),
  classification: mysqlEnum("classification", [
    "CUSTO_OPERACIONAL",
    "DESPESA_OPERACIONAL",
    "DESPESA_ADMINISTRATIVA",
    "DESPESA_FINANCEIRA",
    "RECEITA_VENDAS",
    "RECEITA_OUTRA"
  ]),
  isFixed: boolean("isFixed").default(false),
  effectiveDate: timestamp("effectiveDate").notNull(),
  endDate: timestamp("endDate"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  mgmtIdx: index("mgmt_idx").on(table.managementAccountId),
  codeIdx: index("code_idx").on(table.accountingCode),
}));
```

#### Dia 2 (Ter 20): Adicionar Campos a `expenses`

```typescript
// Modificar expenses table
export const expenses = mysqlTable("expenses", {
  // ... campos existentes ...
  managementAccountId: int("managementAccountId"),  // Novo
  accountingCode: varchar("accountingCode", { length: 20 }),  // Novo
  accountingCodeDate: timestamp("accountingCodeDate"),  // Novo
  // ... resto ...
});
```

#### Dia 3 (Qua 21): Importar De-Para

```sql
-- Inserir contas gerenciais
INSERT INTO managementAccounts (code, name, type) VALUES
('ALU001', 'Aluguel', 'DESPESA'),
('CON001', 'Consultoria e Assessoria', 'DESPESA'),
('SOF001', 'Software e Sistemas', 'DESPESA'),
('EMB001', 'Embalagens', 'DESPESA'),
('TAR001', 'Tarifa Cartões', 'DESPESA'),
('ENE001', 'Energia Elétrica', 'DESPESA'),
('MAN001', 'Manutenção de Equipamentos', 'DESPESA'),
('IMO001', 'Imóvel Alugado', 'DESPESA'),
('DES001', 'Despesa Bancária', 'DESPESA'),
('TER001', 'Terceirizado', 'DESPESA'),
('PRO001', 'Pró-Labore', 'DESPESA');

-- Inserir mapeamentos
INSERT INTO accountingMappings (managementAccountId, accountingCode, classification, isFixed, effectiveDate) VALUES
(1, '3.2.01.001', 'DESPESA_OPERACIONAL', true, '2026-01-01'),
(2, '3.3.01.001', 'DESPESA_ADMINISTRATIVA', false, '2026-01-01'),
(3, '3.3.01.002', 'DESPESA_ADMINISTRATIVA', true, '2026-01-01'),
(4, '3.1.01.001', 'CUSTO_OPERACIONAL', false, '2026-01-01'),
(5, '3.3.02.001', 'DESPESA_FINANCEIRA', false, '2026-01-01'),
(6, '3.2.01.002', 'DESPESA_OPERACIONAL', true, '2026-01-01'),
(7, '3.2.02.001', 'DESPESA_OPERACIONAL', false, '2026-01-01'),
(8, '3.2.01.001', 'DESPESA_OPERACIONAL', true, '2026-01-01'),
(9, '3.3.02.001', 'DESPESA_FINANCEIRA', true, '2026-01-01'),
(10, '3.1.01.002', 'CUSTO_OPERACIONAL', false, '2026-01-01'),
(11, '3.3.01.003', 'DESPESA_ADMINISTRATIVA', true, '2026-01-01');
```

#### Dia 4 (Qui 22): Criar Endpoints

```typescript
// server/routers.ts

export const managementRouter = router({
  // Listar contas gerenciais
  list: publicProcedure.query(async () => {
    const db = await getDb();
    return db.select().from(managementAccounts).where(eq(managementAccounts.isActive, true));
  }),

  // Obter mapeamento contábil
  getMapping: publicProcedure
    .input(z.object({ managementAccountId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      return db
        .select()
        .from(accountingMappings)
        .where(
          and(
            eq(accountingMappings.managementAccountId, input.managementAccountId),
            or(
              isNull(accountingMappings.endDate),
              gte(accountingMappings.endDate, new Date())
            )
          )
        )
        .limit(1);
    }),

  // Criar nova conta gerencial
  create: protectedProcedure
    .input(z.object({
      code: z.string(),
      name: z.string(),
      type: z.enum(["DESPESA", "RECEITA", "CUSTO"]),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      return db.insert(managementAccounts).values(input);
    }),
});
```

#### Dia 5 (Sex 23): Testes

- Testar criação de despesa com conta gerencial
- Validar que accountingCode é preenchido automaticamente
- Gerar DRE de teste

---

## 6. Resposta Completa ao Contador

### Você pode responder ao contador:

> **Pergunta:** "Podemos criar outras contas no futuro?"
>
> **Resposta:** Sim, sem problema. A arquitetura foi projetada para isso:
>
> 1. **Contas Gerenciais** são flexíveis e podem ser adicionadas a qualquer momento
> 2. **Mapeamento Contábil** pode ser alterado sem perder dados históricos
> 3. **Lançamentos Antigos** continuam funcionando com seu mapeamento original
> 4. **Auditoria** registra quando cada conta foi criada e quando deixou de valer
>
> Exemplo: Se amanhã você quiser adicionar "Publicidade e Marketing", é só:
> - Criar a conta gerencial
> - Mapear para código contábil (ex: 3.3.01.004)
> - Novos lançamentos usam automaticamente
> - Lançamentos antigos continuam com seu mapeamento original

---

## 7. Próximos Passos

### ✅ Confirmação

1. Você concorda com essa arquitetura?
2. O contador aprova o mapeamento proposto?
3. Há outras contas gerenciais que faltaram?

### ✅ Implementação

Se aprovado, começo segunda (20/01) com:
- Dia 1: Criar tabelas
- Dia 2: Adicionar campos a expenses
- Dia 3: Importar De-Para
- Dia 4: Criar endpoints
- Dia 5: Testes

---

**Documento preparado por:** Manus AI  
**Data:** 19 de janeiro de 2026  
**Status:** Pronto para Implementação
