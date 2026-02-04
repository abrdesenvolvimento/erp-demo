# Módulo Contábil - ERP Adega Beira Rio

**Versão:** 1.0  
**Data:** 04/02/2026  
**Status:** Documentação para Revisão  
**Autor:** Aurora (Manus AI) com revisão de Orion (ChatGPT) e Gabriel (PO)

---

## 1. Visão Geral

Este documento descreve a arquitetura e implementação do Módulo Contábil do ERP ABRWF. O objetivo é fornecer uma estrutura completa para gestão do Plano de Contas Contábil e Gerencial, com amarrações entre eles, e relatórios contábeis essenciais (Razão, Balanço, DRE).

O módulo será a base para os módulos subsequentes de Outras Receitas, Competência e Fechamento.

---

## 2. Situação Atual

### 2.1 Tabelas Existentes

| Tabela | Registros | Status | Descrição |
|--------|-----------|--------|-----------|
| `managementAccounts` | 50 | ✅ Populada | Contas gerenciais (COP, DAD, DOP, etc.) |
| `accountingMappings` | 50 | ✅ Populada | Mapeamento gerencial → contábil |
| `chartOfAccounts` | 0 | ❌ Vazia | Plano de contas contábil hierárquico |
| `revenueAccounts` | 7 | ✅ Populada | Contas de receita para vendas |
| `revenueEntries` | 122.668 | ✅ Populada | Lançamentos de vendas |

### 2.2 Estrutura de Contas Gerenciais Existente

As contas gerenciais seguem o padrão de código:

| Prefixo | Natureza | Classificação | Exemplos |
|---------|----------|---------------|----------|
| COP | CUSTO | OPERACIONAL | Embalagens, Material de Limpeza, Gás |
| DOP | DESPESA | OPERACIONAL | Aluguel, IPTU, Energia |
| DAD | DESPESA | ADMINISTRATIVA | Consultoria, Software, Contabilidade |
| DCO | DESPESA | COMERCIAL | Marketing, Comissões |
| DFI | DESPESA | FINANCEIRA | Juros, Tarifas Bancárias |
| PAT | PATRIMONIAL | PATRIMONIAL | Imobilizados |

### 2.3 Mapeamentos Contábeis Existentes

Os mapeamentos seguem a estrutura contábil padrão:

| Grupo | Código | Descrição |
|-------|--------|-----------|
| 1.2 | 1.2.01.xxx | Ativo Imobilizado |
| 3.1 | 3.1.01.xxx | Custos Operacionais |
| 3.1 | 3.1.02.xxx | Perdas |
| 3.2 | 3.2.01.xxx | Despesas Operacionais |
| 3.2 | 3.2.02.xxx | Despesas Administrativas |

---

## 3. Estrutura do Plano de Contas Contábil

### 3.1 Estrutura Hierárquica

O Plano de Contas seguirá a estrutura padrão brasileira com 4 níveis:

| Nível | Formato | Exemplo | Tipo |
|-------|---------|---------|------|
| 1 | X | 1, 2, 3, 4, 5 | Sintética (Grupo) |
| 2 | X.X | 1.1, 1.2, 3.1 | Sintética (Subgrupo) |
| 3 | X.X.XX | 1.1.01, 3.1.01 | Sintética (Conta) |
| 4 | X.X.XX.XXX | 1.1.01.001 | Analítica (Subconta) |

### 3.2 Grupos Principais (Nível 1)

| Código | Nome | Natureza | Tipo BP/DRE |
|--------|------|----------|-------------|
| **1** | ATIVO | Devedora | Balanço |
| **2** | PASSIVO | Credora | Balanço |
| **3** | CUSTOS E DESPESAS | Devedora | DRE |
| **4** | RECEITAS | Credora | DRE |
| **5** | PATRIMÔNIO LÍQUIDO | Credora | Balanço |

### 3.3 Estrutura Detalhada Proposta

```
1 - ATIVO (Devedora)
├── 1.1 - ATIVO CIRCULANTE
│   ├── 1.1.01 - Disponibilidades
│   │   ├── 1.1.01.001 - Caixa Geral
│   │   ├── 1.1.01.002 - Banco Itaú
│   │   ├── 1.1.01.003 - Banco Santander
│   │   └── 1.1.01.004 - Banco Bradesco
│   ├── 1.1.02 - Clientes
│   │   ├── 1.1.02.001 - Clientes A Prazo
│   │   └── 1.1.02.002 - (-) Provisão Devedores Duvidosos
│   ├── 1.1.03 - Estoques
│   │   ├── 1.1.03.001 - Mercadorias para Revenda
│   │   └── 1.1.03.002 - Material de Consumo
│   └── 1.1.04 - Outros Créditos
│       ├── 1.1.04.001 - Adiantamentos a Fornecedores
│       └── 1.1.04.002 - Impostos a Recuperar
├── 1.2 - ATIVO NÃO CIRCULANTE
│   ├── 1.2.01 - Imobilizado
│   │   ├── 1.2.01.001 - Equipamentos
│   │   ├── 1.2.01.002 - Móveis e Utensílios
│   │   ├── 1.2.01.003 - Benfeitorias
│   │   └── 1.2.01.004 - (-) Depreciação Acumulada
│   └── 1.2.02 - Intangível
│       └── 1.2.02.001 - Softwares

2 - PASSIVO (Credora)
├── 2.1 - PASSIVO CIRCULANTE
│   ├── 2.1.01 - Fornecedores
│   │   └── 2.1.01.001 - Fornecedores Nacionais
│   ├── 2.1.02 - Obrigações Trabalhistas
│   │   ├── 2.1.02.001 - Salários a Pagar
│   │   ├── 2.1.02.002 - INSS a Recolher
│   │   └── 2.1.02.003 - FGTS a Recolher
│   ├── 2.1.03 - Obrigações Tributárias
│   │   ├── 2.1.03.001 - Simples Nacional a Recolher
│   │   └── 2.1.03.002 - ISS a Recolher
│   └── 2.1.04 - Outras Obrigações
│       └── 2.1.04.001 - Contas a Pagar Diversas
└── 2.2 - PASSIVO NÃO CIRCULANTE
    └── 2.2.01 - Empréstimos e Financiamentos
        └── 2.2.01.001 - Financiamentos Bancários

3 - CUSTOS E DESPESAS (Devedora)
├── 3.1 - CUSTOS OPERACIONAIS
│   ├── 3.1.01 - Custos Diretos
│   │   ├── 3.1.01.001 - Embalagens
│   │   ├── 3.1.01.002 - Material de Limpeza
│   │   ├── 3.1.01.003 - Gás Encanado
│   │   ├── 3.1.01.004 - Fretes
│   │   └── ... (demais custos operacionais)
│   ├── 3.1.02 - Perdas
│   │   ├── 3.1.02.001 - Perdas de Estoque
│   │   └── 3.1.02.002 - Perdas Operacionais
│   └── 3.1.03 - Manutenção
│       └── 3.1.03.001 - Manutenção das Instalações
├── 3.2 - DESPESAS OPERACIONAIS
│   ├── 3.2.01 - Despesas com Ocupação
│   │   ├── 3.2.01.001 - Aluguel
│   │   ├── 3.2.01.002 - IPTU
│   │   ├── 3.2.01.003 - Energia Elétrica
│   │   └── 3.2.01.004 - Água e Esgoto
│   └── 3.2.02 - Despesas Administrativas
│       ├── 3.2.02.001 - Consultoria e Assessoria
│       ├── 3.2.02.002 - Software e Sistemas
│       └── 3.2.02.003 - Contabilidade
├── 3.3 - DESPESAS COMERCIAIS
│   ├── 3.3.01.001 - Marketing e Publicidade
│   └── 3.3.01.002 - Comissões sobre Vendas
├── 3.4 - DESPESAS FINANCEIRAS
│   ├── 3.4.01.001 - Juros Pagos
│   ├── 3.4.01.002 - Tarifas Bancárias
│   └── 3.4.01.003 - Taxas de Cartão
└── 3.5 - DESPESAS COM PESSOAL
    ├── 3.5.01.001 - Salários e Ordenados
    ├── 3.5.01.002 - Encargos Sociais
    └── 3.5.01.003 - Benefícios

4 - RECEITAS (Credora)
├── 4.1 - RECEITA OPERACIONAL BRUTA
│   ├── 4.1.01 - Receita de Vendas
│   │   ├── 4.1.01.001 - Vendas Balcão
│   │   ├── 4.1.01.002 - Vendas Delivery
│   │   └── 4.1.01.003 - Vendas A Prazo
│   └── 4.1.02 - Deduções da Receita
│       ├── 4.1.02.001 - (-) Descontos Concedidos
│       └── 4.1.02.002 - (-) Taxas de Delivery
├── 4.2 - OUTRAS RECEITAS OPERACIONAIS
│   ├── 4.2.01.001 - Receita de Aluguel
│   ├── 4.2.01.002 - Receita de Serviços
│   └── 4.2.01.003 - Outras Receitas
└── 4.3 - RECEITAS FINANCEIRAS
    ├── 4.3.01.001 - Juros Recebidos
    └── 4.3.01.002 - Descontos Obtidos

5 - PATRIMÔNIO LÍQUIDO (Credora)
├── 5.1 - CAPITAL SOCIAL
│   └── 5.1.01.001 - Capital Social Integralizado
├── 5.2 - RESERVAS
│   └── 5.2.01.001 - Reserva de Lucros
└── 5.3 - RESULTADOS
    ├── 5.3.01.001 - Lucros Acumulados
    └── 5.3.01.002 - Prejuízos Acumulados
```

### 3.4 Regras de Natureza (Débito/Crédito)

| Grupo | Natureza Normal | Aumenta com | Diminui com |
|-------|-----------------|-------------|-------------|
| 1 - Ativo | Devedora | Débito | Crédito |
| 2 - Passivo | Credora | Crédito | Débito |
| 3 - Custos/Despesas | Devedora | Débito | Crédito |
| 4 - Receitas | Credora | Crédito | Débito |
| 5 - Patrimônio Líquido | Credora | Crédito | Débito |

### 3.5 Conta Sintética vs Analítica

| Tipo | Permite Lançamento | Possui Filhos | Exemplo |
|------|-------------------|---------------|---------|
| **Sintética** | ❌ Não | ✅ Sim | 1.1 - Ativo Circulante |
| **Analítica** | ✅ Sim | ❌ Não | 1.1.01.001 - Caixa Geral |

**Regra:** Apenas contas de nível 4 (analíticas) podem receber lançamentos contábeis.

---

## 4. Alterações no Schema

### 4.1 Atualização da Tabela `chartOfAccounts`

A tabela já existe mas precisa de ajustes:

```typescript
export const chartOfAccounts = mysqlTable("chartOfAccounts", {
  id: int("id").primaryKey().autoincrement(),
  code: varchar("code", { length: 20 }).notNull(),        // Código contábil (ex: "1.1.01.001")
  name: varchar("name", { length: 150 }).notNull(),       // Nome da conta
  parentCode: varchar("parentCode", { length: 20 }),      // Código da conta pai
  level: int("level").notNull(),                          // Nível (1-4)
  accountType: mysqlEnum("accountType", [
    "ATIVO",
    "PASSIVO", 
    "PATRIMONIO_LIQUIDO",
    "RECEITA",
    "CUSTO",
    "DESPESA"
  ]).notNull(),
  nature: mysqlEnum("nature", ["DEVEDORA", "CREDORA"]).notNull(),  // NOVO: Natureza D/C
  isAnalytical: boolean("isAnalytical").default(true),    // Sintética ou Analítica
  allowsEntries: boolean("allowsEntries").default(true),  // NOVO: Permite lançamentos
  isActive: boolean("isActive").default(true).notNull(),
  displayOrder: int("displayOrder").default(0),           // NOVO: Ordem de exibição
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
```

### 4.2 Nova Tabela: `accountingEntries` (Lançamentos Contábeis)

Para registrar todos os lançamentos contábeis do sistema:

```typescript
export const accountingEntries = mysqlTable("accountingEntries", {
  id: int("id").primaryKey().autoincrement(),
  entryDate: timestamp("entryDate").notNull(),            // Data do lançamento
  accountCode: varchar("accountCode", { length: 20 }).notNull(),  // Conta contábil
  entryType: mysqlEnum("entryType", ["DEBITO", "CREDITO"]).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  description: varchar("description", { length: 255 }),   // Histórico
  
  // Origem do lançamento
  sourceType: mysqlEnum("sourceType", [
    "VENDA",
    "COMPRA", 
    "DESPESA",
    "RECEITA",
    "AJUSTE",
    "ABERTURA",
    "FECHAMENTO"
  ]).notNull(),
  sourceId: int("sourceId"),                              // ID do documento origem
  
  // Controle
  batchId: varchar("batchId", { length: 50 }),            // Lote de lançamentos
  reversalOf: int("reversalOf"),                          // Se é estorno, ID do original
  isReversed: boolean("isReversed").default(false),       // Se foi estornado
  
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});
```

### 4.3 Nova Tabela: `otherRevenues` (Outras Receitas)

Preparação para o módulo de Outras Receitas:

```typescript
export const otherRevenues = mysqlTable("otherRevenues", {
  id: int("id").primaryKey().autoincrement(),
  description: varchar("description", { length: 255 }).notNull(),
  revenueDate: timestamp("revenueDate").notNull(),        // Data da receita
  competenceDate: timestamp("competenceDate").notNull(),  // Data de competência
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  
  // Classificação
  managementAccountId: int("managementAccountId").notNull(),  // Conta gerencial
  partnerId: int("partnerId"),                            // Parceiro (opcional)
  
  // Pagamento
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  isPaid: boolean("isPaid").default(false),
  paidAt: timestamp("paidAt"),
  
  // Recorrência
  isRecurring: boolean("isRecurring").default(false),
  recurrenceType: mysqlEnum("recurrenceType", ["MENSAL", "TRIMESTRAL", "ANUAL"]),
  recurrenceEndDate: timestamp("recurrenceEndDate"),
  
  // Controle
  status: mysqlEnum("status", ["ACTIVE", "CANCELLED"]).default("ACTIVE").notNull(),
  notes: text("notes"),
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
```

---

## 5. Validações e Regras de Negócio

### 5.1 Validações do Plano de Contas

| Regra | Descrição |
|-------|-----------|
| **Código único** | Não pode haver códigos duplicados |
| **Hierarquia válida** | `parentCode` deve existir e ser de nível inferior |
| **Nível correto** | Nível deve corresponder à quantidade de separadores no código |
| **Conta pai sintética** | Conta pai não pode ser analítica |
| **Exclusão segura** | Não pode excluir conta com lançamentos ou filhos |
| **Natureza consistente** | Filhos herdam natureza do pai |

### 5.2 Validações de Lançamentos

| Regra | Descrição |
|-------|-----------|
| **Conta analítica** | Lançamentos apenas em contas analíticas |
| **Conta ativa** | Conta deve estar ativa |
| **Partida dobrada** | Soma de débitos = soma de créditos no lote |
| **Data válida** | Data não pode ser em período fechado |

### 5.3 Validações de Amarração (Mapping)

| Regra | Descrição |
|-------|-----------|
| **Conta contábil existe** | Código contábil deve existir no `chartOfAccounts` |
| **Conta analítica** | Só pode mapear para contas analíticas |
| **Vigência única** | Não pode haver sobreposição de vigências |

---

## 6. Interface do Usuário

### 6.1 Menu de Navegação

```
Contabilidade
├── Plano de Contas Contábil
│   ├── Visualizar (árvore hierárquica)
│   ├── Criar conta
│   └── Editar conta
├── Plano de Contas Gerencial
│   ├── Listar contas
│   ├── Criar conta
│   ├── Editar conta
│   └── Gerenciar amarrações
├── Outras Receitas (futuro)
│   ├── Listar receitas
│   ├── Nova receita
│   └── Receitas recorrentes
└── Relatórios
    ├── Razão Contábil
    ├── Balanço Patrimonial
    └── DRE
```

### 6.2 Tela: Plano de Contas Contábil

**Visualização em árvore:**
- Expandir/colapsar níveis
- Indicador visual de conta sintética vs analítica
- Badge de natureza (D/C)
- Ações: Editar, Adicionar filho, Desativar

**Formulário de criação:**
- Código (auto-sugerido baseado no pai)
- Nome
- Conta pai (seletor hierárquico)
- Tipo de conta (Sintética/Analítica)
- Natureza (herdada do grupo)

### 6.3 Tela: Razão Contábil

**Filtros:**
- Conta contábil (com autocomplete)
- Período (data inicial e final)
- Tipo de lançamento (Débito/Crédito/Todos)

**Colunas:**
- Data
- Histórico
- Débito
- Crédito
- Saldo
- Documento origem

**Totalizadores:**
- Saldo anterior
- Total débitos
- Total créditos
- Saldo final

### 6.4 Tela: Balanço Patrimonial

**Estrutura:**
```
ATIVO                          | PASSIVO + PL
-------------------------------|-------------------------------
ATIVO CIRCULANTE        XX.XXX | PASSIVO CIRCULANTE      XX.XXX
  Disponibilidades      XX.XXX |   Fornecedores          XX.XXX
    Caixa               XX.XXX |   Obrig. Trabalhistas   XX.XXX
    Bancos              XX.XXX |   Obrig. Tributárias    XX.XXX
  Clientes              XX.XXX | PASSIVO NÃO CIRCULANTE  XX.XXX
  Estoques              XX.XXX |   Empréstimos           XX.XXX
ATIVO NÃO CIRCULANTE    XX.XXX | PATRIMÔNIO LÍQUIDO      XX.XXX
  Imobilizado           XX.XXX |   Capital Social        XX.XXX
  (-) Depreciação      (XX.XXX)|   Lucros Acumulados     XX.XXX
-------------------------------|-------------------------------
TOTAL ATIVO            XXX.XXX | TOTAL PASSIVO + PL     XXX.XXX
```

### 6.5 Tela: DRE

**Estrutura:**
```
DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO
Período: XX/XX/XXXX a XX/XX/XXXX

RECEITA OPERACIONAL BRUTA                    XXX.XXX
  Vendas Balcão                              XXX.XXX
  Vendas Delivery                            XXX.XXX
  Vendas A Prazo                             XXX.XXX

(-) DEDUÇÕES DA RECEITA                      (XX.XXX)
  Descontos Concedidos                       (XX.XXX)
  Taxas de Delivery                          (XX.XXX)

= RECEITA OPERACIONAL LÍQUIDA                XXX.XXX

(-) CUSTOS OPERACIONAIS                      (XX.XXX)
  Custos Diretos                             (XX.XXX)
  Perdas                                     (XX.XXX)

= LUCRO BRUTO                                XXX.XXX

(-) DESPESAS OPERACIONAIS                    (XX.XXX)
  Despesas com Ocupação                      (XX.XXX)
  Despesas Administrativas                   (XX.XXX)
  Despesas Comerciais                        (XX.XXX)
  Despesas com Pessoal                       (XX.XXX)

= RESULTADO OPERACIONAL                       XX.XXX

(+/-) RESULTADO FINANCEIRO                    (X.XXX)
  Receitas Financeiras                         X.XXX
  (-) Despesas Financeiras                   (XX.XXX)

(+) OUTRAS RECEITAS                            X.XXX

= RESULTADO ANTES DO IR/CSLL                  XX.XXX

(-) IR/CSLL                                   (X.XXX)

= RESULTADO LÍQUIDO DO EXERCÍCIO              XX.XXX
```

---

## 7. Fluxo de Contabilização

### 7.1 Vendas (já implementado)

```
Venda Balcão R$ 100,00:
  D - 1.1.01.001 Caixa Geral           100,00
  C - 4.1.01.001 Vendas Balcão         100,00

Venda A Prazo R$ 100,00:
  D - 1.1.02.001 Clientes A Prazo      100,00
  C - 4.1.01.003 Vendas A Prazo        100,00
```

### 7.2 Compras (a implementar)

```
Compra de Mercadorias R$ 500,00:
  D - 1.1.03.001 Mercadorias           500,00
  C - 2.1.01.001 Fornecedores          500,00

Pagamento ao Fornecedor:
  D - 2.1.01.001 Fornecedores          500,00
  C - 1.1.01.002 Banco Itaú            500,00
```

### 7.3 Despesas (a implementar)

```
Despesa de Aluguel R$ 3.000,00:
  D - 3.2.01.001 Aluguel             3.000,00
  C - 2.1.04.001 Contas a Pagar      3.000,00

Pagamento do Aluguel:
  D - 2.1.04.001 Contas a Pagar      3.000,00
  C - 1.1.01.002 Banco Itaú          3.000,00
```

### 7.4 Outras Receitas (a implementar)

```
Receita de Aluguel R$ 1.000,00:
  D - 1.1.01.002 Banco Itaú          1.000,00
  C - 4.2.01.001 Receita de Aluguel  1.000,00
```

---

## 8. Fases de Implementação

### Fase 1: Plano de Contas Contábil (8-12h)

| Item | Descrição | Esforço |
|------|-----------|---------|
| 1.1 | Atualizar schema `chartOfAccounts` | 1h |
| 1.2 | Popular plano de contas inicial | 2h |
| 1.3 | Backend: CRUD de contas | 3h |
| 1.4 | Frontend: Visualização em árvore | 3h |
| 1.5 | Frontend: Formulário de criação/edição | 2h |
| 1.6 | Testes | 1h |

### Fase 2: Plano de Contas Gerencial + Amarrações (6-8h)

| Item | Descrição | Esforço |
|------|-----------|---------|
| 2.1 | Backend: CRUD de contas gerenciais | 2h |
| 2.2 | Backend: Gestão de amarrações | 2h |
| 2.3 | Frontend: Lista de contas gerenciais | 2h |
| 2.4 | Frontend: Modal de amarração | 1h |
| 2.5 | Testes | 1h |

### Fase 3: Estrutura de Lançamentos (4-6h)

| Item | Descrição | Esforço |
|------|-----------|---------|
| 3.1 | Criar tabela `accountingEntries` | 1h |
| 3.2 | Funções de lançamento com partida dobrada | 2h |
| 3.3 | Integração com vendas existentes | 2h |
| 3.4 | Testes | 1h |

### Fase 4: Relatório Razão (4-6h)

| Item | Descrição | Esforço |
|------|-----------|---------|
| 4.1 | Backend: Query de razão por conta | 2h |
| 4.2 | Frontend: Tela de filtros | 1h |
| 4.3 | Frontend: Tabela com saldos | 2h |
| 4.4 | Exportação PDF/Excel | 1h |

### Fase 5: Relatório Balanço (4-6h)

| Item | Descrição | Esforço |
|------|-----------|---------|
| 5.1 | Backend: Agregação por grupo | 2h |
| 5.2 | Frontend: Layout lado a lado | 2h |
| 5.3 | Drill-down por conta | 1h |
| 5.4 | Exportação PDF | 1h |

### Fase 6: Relatório DRE (4-6h)

| Item | Descrição | Esforço |
|------|-----------|---------|
| 6.1 | Backend: Cálculo de resultado | 2h |
| 6.2 | Frontend: Layout estruturado | 2h |
| 6.3 | Comparativo com período anterior | 1h |
| 6.4 | Exportação PDF | 1h |

### Fase 7: Preparação Outras Receitas (2-4h)

| Item | Descrição | Esforço |
|------|-----------|---------|
| 7.1 | Criar tabela `otherRevenues` | 1h |
| 7.2 | Criar contas gerenciais de receita | 1h |
| 7.3 | Documentar fluxo de contabilização | 1h |
| 7.4 | Testes | 1h |

**Total estimado: 32-48 horas**

---

## 9. Contas de Banco (V1)

### 9.1 Abordagem V1

Na V1, bancos e caixa serão contas contábeis normais no grupo **1.1 - Disponibilidades**:

| Código | Nome | Tipo |
|--------|------|------|
| 1.1.01.001 | Caixa Geral | Analítica |
| 1.1.01.002 | Banco Itaú | Analítica |
| 1.1.01.003 | Banco Santander | Analítica |
| 1.1.01.004 | Banco Bradesco | Analítica |
| 1.1.01.005 | Banco do Brasil | Analítica |

### 9.2 Abordagem V2 (Futuro)

Quando implementarmos conciliação bancária, criaremos a tabela `bankAccounts`:

```typescript
export const bankAccounts = mysqlTable("bankAccounts", {
  id: int("id").primaryKey().autoincrement(),
  accountCode: varchar("accountCode", { length: 20 }).notNull(),  // FK para chartOfAccounts
  bankName: varchar("bankName", { length: 100 }).notNull(),
  bankCode: varchar("bankCode", { length: 10 }),                  // Código FEBRABAN
  agency: varchar("agency", { length: 10 }),
  accountNumber: varchar("accountNumber", { length: 20 }),
  accountType: mysqlEnum("accountType", ["CORRENTE", "POUPANCA"]),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});
```

---

## 10. Checklist de Implementação

### Pré-requisitos
- [x] Estrutura de contas gerenciais existente
- [x] Mapeamentos contábeis existentes
- [x] Contabilização de vendas funcionando

### Fase 1: Plano de Contas Contábil
- [ ] Atualizar schema `chartOfAccounts` (adicionar nature, allowsEntries, displayOrder)
- [ ] Script de população do plano de contas inicial
- [ ] Backend: procedures CRUD
- [ ] Frontend: Visualização em árvore
- [ ] Frontend: Formulário de criação/edição
- [ ] Testes

### Fase 2: Plano Gerencial + Amarrações
- [ ] Backend: CRUD de contas gerenciais
- [ ] Backend: Gestão de amarrações com validação
- [ ] Frontend: Lista de contas gerenciais
- [ ] Frontend: Modal de amarração
- [ ] Testes

### Fase 3: Estrutura de Lançamentos
- [ ] Criar tabela `accountingEntries`
- [ ] Funções de lançamento com partida dobrada
- [ ] Migrar lançamentos de vendas existentes
- [ ] Testes

### Fase 4-6: Relatórios
- [ ] Razão Contábil
- [ ] Balanço Patrimonial
- [ ] DRE

### Fase 7: Preparação Outras Receitas
- [ ] Criar tabela `otherRevenues`
- [ ] Criar contas gerenciais de receita
- [ ] Documentar fluxo

---

## 11. Conclusão

O Módulo Contábil estabelecerá a base para toda a gestão financeira do ERP, permitindo:

1. **Gestão completa do Plano de Contas** - Contábil e Gerencial com amarrações
2. **Rastreabilidade** - Todos os lançamentos com origem identificada
3. **Relatórios essenciais** - Razão, Balanço e DRE
4. **Preparação para expansão** - Estrutura pronta para Outras Receitas e Competência

A implementação em fases permite entregas incrementais e validação contínua com o usuário.

---

**Próximos Passos:**
1. Revisão deste documento pelo Orion
2. Aprovação do Gabriel
3. Início da implementação pela Fase 1
