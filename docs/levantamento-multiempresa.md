# Levantamento Completo — Migração Multiempresa

**ERP Adega Beira Rio**
**Data:** 22/02/2026 | **Autor:** Manus AI

---

## 1. Visão Geral

O sistema ERP atualmente opera em modo **single-tenant** (empresa única). A migração para multiempresa exige que todas as tabelas operacionais recebam um campo `companyId` e que todas as queries, routers e componentes de frontend passem a filtrar por empresa ativa. Este documento mapeia **cada tabela, módulo e componente** que precisa ser alterado, organizando o trabalho em fases sequenciais.

### 1.1 Estado Atual

O schema possui **36 tabelas** no total. Destas, apenas **10 tabelas** (módulo contábil e governança) já possuem `companyId`. As **26 tabelas operacionais restantes** não possuem nenhum isolamento por empresa.

| Situação | Qtd Tabelas | Módulos |
|----------|-------------|---------|
| **Já possuem companyId** | 10 | Contabilidade (chartOfAccounts, journals, accountingEntries, journalSources, accountingPeriods, otherRevenues), Governança (governanceSettings, governanceAuditLog, accountingBatchLog) + managementAccounts (parcial) |
| **Não possuem companyId** | 26 | Cadastros, Vendas, Compras, Estoque, Despesas, Financeiro, Metas, iFood, Backup |

---

## 2. Tabelas que Precisam de companyId

### 2.1 Cadastros Base (Fase 1 — Fundação)

Estas tabelas são referenciadas por praticamente todos os módulos. Devem ser migradas primeiro.

| Tabela | Descrição | Impacto | Prioridade |
|--------|-----------|---------|------------|
| `categories` | Categorias de produtos | Alto — referenciada por products, expenses | **Crítica** |
| `subcategories` | Subcategorias | Alto — referenciada por products | **Crítica** |
| `salesChannels` | Canais de venda (Balcão, iFood, 99, Próprio) | Alto — referenciada por sales, productPrices, revenueGoals | **Crítica** |
| `products` | Cadastro de produtos (1006 registros) | Muito Alto — referenciada por 8+ tabelas | **Crítica** |
| `productCompositions` | Composição de packs | Médio — depende de products | **Crítica** |
| `productPrices` | Preços por canal | Alto — depende de products + salesChannels | **Crítica** |
| `partners` | Clientes e fornecedores | Muito Alto — referenciada por vendas, compras, despesas, recebíveis | **Crítica** |

### 2.2 Módulo de Vendas (Fase 2)

| Tabela | Descrição | Registros Estimados | Prioridade |
|--------|-----------|---------------------|------------|
| `sales` | Vendas | Alto volume | **Alta** |
| `saleItems` | Itens de venda | Alto volume | **Alta** |

### 2.3 Módulo de Compras (Fase 2)

| Tabela | Descrição | Registros Estimados | Prioridade |
|--------|-----------|---------------------|------------|
| `purchaseOrders` | Ordens de compra | Médio volume | **Alta** |
| `purchaseOrderItems` | Itens de compra | Médio volume | **Alta** |
| `purchaseInstallments` | Parcelas de compra | Médio volume | **Alta** |

### 2.4 Módulo de Estoque (Fase 2)

| Tabela | Descrição | Registros Estimados | Prioridade |
|--------|-----------|---------------------|------------|
| `productMovements` | Movimentações de estoque | Alto volume | **Alta** |

### 2.5 Módulo de Despesas (Fase 2)

| Tabela | Descrição | Registros Estimados | Prioridade |
|--------|-----------|---------------------|------------|
| `expenses` | Despesas operacionais | Médio volume | **Alta** |
| `expenseInstallments` | Parcelas de despesas | Médio volume | **Alta** |
| `expenseCategories` | Categorias de despesas | Baixo volume | **Alta** |

### 2.6 Módulo Financeiro (Fase 3)

| Tabela | Descrição | Registros Estimados | Prioridade |
|--------|-----------|---------------------|------------|
| `accountsPayable` | Contas a pagar | Médio volume | **Alta** |
| `receivables` | Recebíveis | Médio volume | **Alta** |
| `receivableInstallments` | Parcelas de recebíveis | Médio volume | **Alta** |
| `receivablePayments` | Pagamentos de recebíveis | Médio volume | **Alta** |
| `customerPayments` | Pagamentos de clientes (conta corrente) | Médio volume | **Alta** |
| `customerDebits` | Débitos manuais de clientes | Baixo volume | **Alta** |

### 2.7 Módulo de Metas e Receitas (Fase 3)

| Tabela | Descrição | Registros Estimados | Prioridade |
|--------|-----------|---------------------|------------|
| `revenueGoals` | Metas de faturamento | Baixo volume | **Média** |
| `revenueGoalHistory` | Histórico de alterações de metas | Baixo volume | **Média** |
| `revenueAccounts` | Contas de receita | Baixo volume | **Média** |
| `revenueEntries` | Lançamentos de receita | Alto volume | **Média** |

### 2.8 Módulo iFood (Fase 4)

| Tabela | Descrição | Registros Estimados | Prioridade |
|--------|-----------|---------------------|------------|
| `ifoodProductMappings` | Mapeamento De/Para iFood | Baixo volume | **Média** |
| `ifoodImportLogs` | Logs de importação | Baixo volume | **Média** |
| `ifoodImportedOrders` | Pedidos importados | Médio volume | **Média** |
| `ifoodPriceDivergences` | Divergências de preço | Baixo volume | **Média** |

### 2.9 Tabela de Sistema

| Tabela | Descrição | Alteração Necessária | Prioridade |
|--------|-----------|---------------------|------------|
| `users` | Usuários do sistema | Adicionar tabela de relação `userCompanies` (N:N) | **Crítica** |
| `backupLogs` | Logs de backup | Opcional — backup é global | **Baixa** |

---

## 3. Novas Tabelas Necessárias

### 3.1 Tabela `companies` (Cadastro de Empresas)

```
companies
├── id: int (PK, autoincrement)
├── name: varchar(200) — Nome da empresa
├── tradeName: varchar(200) — Nome fantasia
├── docNumber: varchar(20) — CNPJ
├── active: boolean
├── createdAt: timestamp
└── updatedAt: timestamp
```

### 3.2 Tabela `userCompanies` (Relação Usuário ↔ Empresa)

```
userCompanies
├── id: int (PK, autoincrement)
├── userId: varchar(64) — FK para users
├── companyId: int — FK para companies
├── role: enum('admin', 'operacional', 'consultor') — Papel na empresa
├── isDefault: boolean — Empresa padrão ao logar
├── createdAt: timestamp
└── updatedAt: timestamp
```

Esta tabela permite que um mesmo usuário acesse múltiplas empresas com papéis diferentes em cada uma.

---

## 4. Alterações no Backend

### 4.1 Arquivos de Queries (SQL Direto)

Estes arquivos usam SQL puro e **nenhum** filtra por `companyId` atualmente.

| Arquivo | Funções Afetadas | Qtd Queries |
|---------|-----------------|-------------|
| `server/closingQueries.ts` | getSalesByChannel, getSalesByCategory, getExpensesByManagementAccount, getPurchasesBySupplier, getStockByCategory, getRevenueByPaymentMethod, getRevenueGoalProgress | **~15 queries** |
| `server/stockAnalysisQueries.ts` | getStockAnalysis (query principal com 4 sub-queries) | **~5 queries** |

**Ação necessária:** Todas as queries precisam receber `companyId` como parâmetro e adicionar `WHERE ... AND p.companyId = ?` (ou equivalente para cada tabela principal da query).

### 4.2 Arquivo db.ts (Query Helpers — Drizzle ORM)

O arquivo `server/db.ts` é o maior do projeto (~8200 linhas) e contém **todas** as operações de banco. Praticamente **todas as funções** precisam ser alteradas para receber e filtrar por `companyId`.

| Módulo no db.ts | Funções Estimadas | Status companyId |
|-----------------|-------------------|-----------------|
| Produtos (CRUD, listagem, busca) | ~15 funções | **Nenhuma filtra** |
| Vendas (criar, listar, cancelar, editar) | ~10 funções | **Nenhuma filtra** |
| Compras (criar, listar, cancelar, editar) | ~10 funções | **Nenhuma filtra** |
| Despesas (criar, listar, cancelar, editar) | ~8 funções | **Nenhuma filtra** |
| Parceiros (CRUD) | ~5 funções | **Nenhuma filtra** |
| Recebíveis (criar, listar, pagar) | ~8 funções | **Nenhuma filtra** |
| Contas a Pagar (criar, listar, pagar) | ~5 funções | **Nenhuma filtra** |
| Metas (CRUD) | ~4 funções | **Nenhuma filtra** |
| Fechamento Mensal (getMonthlyClosing) | 1 função orquestradora | **Não filtra** |
| Governança (settings, períodos, auditoria) | ~12 funções | **Já filtram** (default=1) |
| Contabilidade (journals, entries) | ~10 funções | **Já filtram** (default=1) |

**Estimativa total:** ~80 funções precisam ser alteradas no db.ts.

### 4.3 Routers (tRPC)

| Arquivo | Procedures Afetadas | Status |
|---------|-------------------|--------|
| `server/routers.ts` (~2600 linhas) | Todos os procedures de produtos, vendas, compras, despesas, parceiros, recebíveis, metas, fechamento | **Nenhum passa companyId** |
| `server/routers/accounting.ts` | Procedures contábeis | **Já passam** (default=1) |
| `server/routers/stockAnalysis.ts` | Procedures de análise de estoque | **Não passam** |
| `server/routers/ifoodImport.ts` | Procedures de importação iFood | **Não passam** |

**Ação necessária:** Cada procedure protegido precisa extrair `companyId` do contexto do usuário (`ctx.user.activeCompanyId`) em vez de receber como parâmetro opcional. Isso garante que o filtro de empresa seja automático e não manipulável pelo frontend.

### 4.4 Infraestrutura e Schedulers

| Arquivo | Problema | Ação |
|---------|----------|------|
| `server/accountingScheduler.ts` | Hardcoded `companyId: 1` | Iterar sobre todas as empresas ativas |
| `server/backupEndpoint.ts` | Backup global (sem companyId) | Manter global — backup é do banco inteiro |
| `server/_core/context.ts` | Contexto do usuário não inclui empresa ativa | Adicionar `activeCompanyId` ao contexto |

---

## 5. Alterações no Frontend

### 5.1 Novo Contexto: CompanyContext

Criar `client/src/contexts/CompanyContext.tsx` com:

- Estado da empresa ativa (`activeCompany`)
- Lista de empresas do usuário (`userCompanies`)
- Função para trocar empresa (`switchCompany`)
- Persistência da empresa ativa em localStorage

### 5.2 Seletor de Empresa

Adicionar no **DashboardLayout** (sidebar ou header) um seletor de empresa que:

- Mostra a empresa ativa atual
- Lista todas as empresas do usuário
- Permite trocar de empresa sem fazer logout
- Invalida todas as queries tRPC ao trocar

### 5.3 Páginas Afetadas (29 páginas)

**Todas as 29 páginas** do sistema precisam ser verificadas, mas a maioria não precisa de alteração direta se o `companyId` for injetado automaticamente via contexto tRPC. As páginas que podem precisar de ajustes específicos são:

| Página | Ajuste Necessário |
|--------|-------------------|
| `Home.tsx` (Dashboard) | Cards devem filtrar por empresa |
| `Produtos.tsx` | Listagem por empresa |
| `Vendas.tsx` | Vendas por empresa |
| `Compras.tsx` | Compras por empresa |
| `Despesas.tsx` | Despesas por empresa |
| `Parceiros.tsx` | Parceiros por empresa |
| `ContasReceber.tsx` / `ContasReceberNovo.tsx` | Recebíveis por empresa |
| `ContasPagar.tsx` | Contas a pagar por empresa |
| `Metas.tsx` | Metas por empresa |
| `FechamentoMensalNovo.tsx` | Fechamento por empresa |
| `AnaliseEstoque.tsx` | Análise por empresa |
| `AnáliseVendas.tsx` | Análise por empresa |
| `AnaliseDespesas.tsx` | Análise por empresa |
| `AnaliseCanal.tsx` / `AnaliseDelivery.tsx` | Análise por empresa |
| `ImportadorIfood.tsx` | Importação por empresa |
| `PlanoContas.tsx` / `RelatoriosContabeis.tsx` | Já usam companyId (ajustar para contexto) |
| `GovernancaContabil.tsx` | Já usa companyId (ajustar para contexto) |
| `Usuarios.tsx` | Adicionar gestão de empresas por usuário |

### 5.4 Tabela `users` — Gestão de Acesso

A tela de `Usuarios.tsx` precisa ser expandida para:

- Associar usuários a empresas (tabela `userCompanies`)
- Definir papel por empresa (admin, operacional, consultor)
- Definir empresa padrão do usuário

---

## 6. Plano de Migração de Dados

### 6.1 Estratégia

A migração dos dados existentes (Adega Beira Rio) é simples porque todos os registros pertencem à mesma empresa. O processo seria:

1. Criar registro na tabela `companies` (id=1, name="Adega Beira Rio")
2. Executar `ALTER TABLE` para adicionar `companyId INT NOT NULL DEFAULT 1` em cada tabela
3. Criar índices compostos (`companyId` + campos mais filtrados)
4. Atualizar `userCompanies` para associar usuários existentes à empresa 1

### 6.2 Riscos

| Risco | Mitigação |
|-------|-----------|
| Downtime durante ALTER TABLE | Executar em horário de baixo uso; tabelas grandes (sales, saleItems) podem levar minutos |
| Queries sem filtro de empresa | Implementar middleware que rejeita queries sem companyId |
| Dados cruzados entre empresas | Testes automatizados com 2 empresas de teste |
| Performance com índices novos | Índices compostos (companyId + campo) em vez de índice simples |

---

## 7. Fases de Implementação Sugeridas

### Fase 1 — Fundação (Estimativa: 2-3 sessões)

1. Criar tabelas `companies` e `userCompanies`
2. Adicionar `companyId` nas tabelas de cadastro base (categories, subcategories, salesChannels, products, productCompositions, productPrices, partners)
3. Criar CompanyContext no frontend + seletor de empresa
4. Alterar contexto tRPC para injetar `activeCompanyId`
5. Migrar dados existentes (DEFAULT 1)

### Fase 2 — Módulos Operacionais (Estimativa: 2-3 sessões)

1. Adicionar `companyId` nas tabelas de transação (sales, saleItems, purchaseOrders, purchaseOrderItems, purchaseInstallments, productMovements, expenses, expenseInstallments, expenseCategories)
2. Alterar todas as queries do db.ts para filtrar por companyId
3. Alterar closingQueries.ts e stockAnalysisQueries.ts
4. Atualizar routers.ts para usar ctx.user.activeCompanyId

### Fase 3 — Módulos Financeiros e Metas (Estimativa: 1-2 sessões)

1. Adicionar `companyId` nas tabelas financeiras (accountsPayable, receivables, receivableInstallments, receivablePayments, customerPayments, customerDebits)
2. Adicionar `companyId` nas tabelas de metas (revenueGoals, revenueGoalHistory, revenueAccounts, revenueEntries)
3. Atualizar queries e routers correspondentes

### Fase 4 — iFood e Ajustes Finais (Estimativa: 1 sessão)

1. Adicionar `companyId` nas tabelas iFood
2. Atualizar accountingScheduler para iterar empresas
3. Atualizar tela de Usuários para gestão multiempresa
4. Testes end-to-end com 2 empresas

---

## 8. Resumo Quantitativo

| Item | Quantidade |
|------|-----------|
| Tabelas a alterar (adicionar companyId) | **26** |
| Novas tabelas a criar | **2** (companies, userCompanies) |
| Funções no db.ts a alterar | **~80** |
| Queries SQL diretas a alterar | **~20** |
| Routers/procedures a alterar | **~60** |
| Páginas frontend a verificar | **29** |
| Novo contexto React | **1** (CompanyContext) |
| Novo componente UI | **1** (CompanySwitcher) |
| Scheduler a alterar | **1** (accountingScheduler) |

**Estimativa total:** 6-9 sessões de trabalho, distribuídas em 4 fases.

---

## 9. Decisões a Alinhar com Gabriel

Antes de iniciar a implementação, precisamos definir:

1. **Dados compartilhados vs isolados:** Categorias de produtos, subcategorias e canais de venda devem ser compartilhados entre empresas ou cada empresa terá os seus próprios? (Recomendação: **isolados por empresa** para máxima flexibilidade)

2. **Parceiros compartilhados:** Um fornecedor que atende duas empresas deve ser cadastrado uma vez (compartilhado) ou duas vezes (isolado)? (Recomendação: **isolados**, pois condições comerciais podem diferir)

3. **Plano de Contas:** Cada empresa terá seu próprio plano de contas contábil e gerencial? (Recomendação: **sim**, já que a estrutura contábil pode variar)

4. **Usuário admin global:** Deve existir um "super admin" que vê todas as empresas simultaneamente, ou o admin sempre opera dentro de uma empresa? (Recomendação: **admin por empresa** + tela de troca)

5. **Segunda empresa:** Qual será a segunda empresa a ser cadastrada? Já temos dados para migrar ou começaremos do zero?

6. **Backup:** Manter backup global (banco inteiro) ou separar por empresa? (Recomendação: **global**, mais simples e seguro)
