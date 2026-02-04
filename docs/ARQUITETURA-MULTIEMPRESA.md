# Arquitetura Multiempresa - ERP Adega Beira Rio

**Versão:** 1.0 (Documentação)  
**Data:** 04/02/2026  
**Status:** Planejamento - Sem implementação de código  
**Autor:** Aurora (Manus AI) com revisão de Orion (ChatGPT)

---

## 1. Visão Geral

Este documento descreve a arquitetura proposta para suporte a múltiplas empresas no sistema ERP ABRWF. O objetivo é permitir que o sistema gerencie operações de diferentes unidades de negócio de forma isolada, mantendo a integridade dos dados e a capacidade de consolidação para análises gerenciais.

A implementação será realizada **após** a estabilização dos módulos de competência, fechamento e contábil, evitando retrabalho e garantindo que novos módulos já nasçam com suporte multiempresa.

---

## 2. Contexto de Negócio

### 2.1 Situação Atual

O sistema atualmente opera com uma única empresa implícita (Adega Beira Rio). Todas as tabelas e operações assumem este contexto único.

### 2.2 Necessidade Futura

Com a expansão do negócio, será necessário:

- Gerenciar múltiplas unidades (filiais, franquias ou empresas do grupo)
- Manter dados isolados por empresa para fins fiscais e contábeis
- Permitir consolidação de relatórios para visão gerencial do grupo
- Controlar acesso de usuários por empresa

---

## 3. Modelo de Dados Proposto

### 3.1 Nova Tabela: `companies`

```sql
CREATE TABLE companies (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL UNIQUE,        -- Código interno (ex: "ABRWF", "FILIAL01")
  name VARCHAR(200) NOT NULL,              -- Nome fantasia
  legalName VARCHAR(200),                  -- Razão social
  cnpj VARCHAR(18),                        -- CNPJ formatado
  stateRegistration VARCHAR(20),           -- Inscrição estadual
  address TEXT,                            -- Endereço completo
  phone VARCHAR(20),
  email VARCHAR(320),
  active BOOLEAN DEFAULT TRUE NOT NULL,
  isHeadquarters BOOLEAN DEFAULT FALSE,    -- Se é a matriz
  parentCompanyId INT,                     -- FK para empresa matriz (se filial)
  timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
  
  FOREIGN KEY (parentCompanyId) REFERENCES companies(id)
);
```

### 3.2 Estratégia de Isolamento

A estratégia escolhida é **coluna discriminadora** (`companyId`) em todas as tabelas transacionais. Esta abordagem oferece:

| Aspecto | Vantagem |
|---------|----------|
| **Simplicidade** | Não requer múltiplos bancos ou schemas |
| **Consolidação** | Fácil agregar dados de todas as empresas |
| **Migração** | Menor impacto na estrutura existente |
| **Custo** | Não aumenta custos de infraestrutura |

---

## 4. Impacto por Tabela

### 4.1 Tabelas que Receberão `companyId`

As seguintes tabelas precisarão da coluna `companyId` para isolamento:

| Tabela | Tipo | Impacto | Prioridade |
|--------|------|---------|------------|
| `products` | Cadastro | Alto - Estoque por empresa | Alta |
| `productPrices` | Cadastro | Alto - Preços podem variar | Alta |
| `productMovements` | Transacional | Alto - Movimentações isoladas | Alta |
| `partners` | Cadastro | Médio - Fornecedores/clientes | Alta |
| `sales` | Transacional | Alto - Vendas por empresa | Alta |
| `saleItems` | Transacional | Herda de sales | Alta |
| `purchaseOrders` | Transacional | Alto - Compras por empresa | Alta |
| `purchaseOrderItems` | Transacional | Herda de purchaseOrders | Alta |
| `accountsPayable` | Financeiro | Alto - Contas a pagar | Alta |
| `purchaseInstallments` | Financeiro | Herda de accountsPayable | Alta |
| `expenses` | Financeiro | Alto - Despesas por empresa | Alta |
| `expenseInstallments` | Financeiro | Herda de expenses | Alta |
| `receivables` | Financeiro | Alto - Contas a receber | Alta |
| `receivableInstallments` | Financeiro | Herda de receivables | Alta |
| `receivablePayments` | Financeiro | Herda de receivables | Alta |
| `customerPayments` | Financeiro | Alto - Pagamentos de clientes | Alta |
| `customerDebits` | Financeiro | Alto - Débitos de clientes | Alta |
| `revenueGoals` | Análise | Médio - Metas por empresa | Média |
| `revenueGoalHistory` | Análise | Herda de revenueGoals | Média |
| `revenueEntries` | Contábil | Alto - Receitas por empresa | Alta |
| `backupLogs` | Sistema | Baixo - Logs globais | Baixa |

### 4.2 Tabelas Compartilhadas (Sem `companyId`)

Algumas tabelas podem ser compartilhadas entre empresas:

| Tabela | Justificativa |
|--------|---------------|
| `users` | Usuários podem ter acesso a múltiplas empresas |
| `categories` | Categorias de produtos padronizadas |
| `subcategories` | Subcategorias padronizadas |
| `salesChannels` | Canais de venda padronizados |
| `expenseCategories` | Categorias de despesas padronizadas |
| `managementAccounts` | Plano de contas gerencial único |
| `chartOfAccounts` | Plano de contas contábil único |
| `accountingMappings` | Mapeamentos contábeis únicos |

### 4.3 Nova Tabela: `userCompanyAccess`

Para controlar acesso de usuários por empresa:

```sql
CREATE TABLE userCompanyAccess (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId VARCHAR(64) NOT NULL,
  companyId INT NOT NULL,
  role ENUM('admin', 'operacional', 'consultor') NOT NULL,
  isDefault BOOLEAN DEFAULT FALSE,         -- Empresa padrão do usuário
  createdAt TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (companyId) REFERENCES companies(id),
  UNIQUE KEY (userId, companyId)
);
```

---

## 5. Impacto no Código

### 5.1 Camada de Banco de Dados (`server/db.ts`)

Todas as funções de query precisarão:

1. Receber `companyId` como parâmetro obrigatório
2. Incluir filtro `WHERE companyId = ?` em todas as consultas
3. Incluir `companyId` em todos os INSERTs

**Exemplo de migração:**

```typescript
// ANTES
export async function getProducts(activeOnly = true) {
  const db = await getDb();
  return db.select().from(products).where(eq(products.active, activeOnly));
}

// DEPOIS
export async function getProducts(companyId: number, activeOnly = true) {
  const db = await getDb();
  return db.select()
    .from(products)
    .where(and(
      eq(products.companyId, companyId),
      activeOnly ? eq(products.active, true) : undefined
    ));
}
```

### 5.2 Camada de API (`server/routers.ts`)

Todas as procedures precisarão:

1. Extrair `companyId` do contexto do usuário
2. Passar `companyId` para as funções de banco
3. Validar se o usuário tem acesso à empresa

**Exemplo de migração:**

```typescript
// ANTES
products: router({
  list: protectedProcedure.query(({ ctx }) => 
    getProducts(true)
  ),
}),

// DEPOIS
products: router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const companyId = await getUserDefaultCompany(ctx.user.id);
    return getProducts(companyId, true);
  }),
}),
```

### 5.3 Camada de Frontend

O frontend precisará:

1. Armazenar empresa ativa no contexto/estado
2. Permitir troca de empresa (se usuário tiver acesso a múltiplas)
3. Exibir indicador visual da empresa ativa
4. Recarregar dados ao trocar de empresa

---

## 6. Estratégia de Migração

### 6.1 Fase 1: Preparação (Sem downtime)

1. Criar tabela `companies` com empresa atual (id=1)
2. Criar tabela `userCompanyAccess` com acessos atuais
3. Adicionar coluna `companyId` em todas as tabelas (nullable, default=1)
4. Executar UPDATE para preencher `companyId=1` em registros existentes

### 6.2 Fase 2: Migração de Código

1. Atualizar funções de db.ts para aceitar `companyId`
2. Atualizar routers.ts para extrair e passar `companyId`
3. Manter compatibilidade: se `companyId` não informado, usar empresa 1
4. Testes extensivos com empresa única

### 6.3 Fase 3: Ativação

1. Alterar coluna `companyId` para NOT NULL
2. Adicionar índices em `companyId` para performance
3. Remover fallback de empresa 1
4. Habilitar criação de novas empresas

### 6.4 Fase 4: Consolidação

1. Implementar relatórios consolidados
2. Implementar dashboard multi-empresa
3. Implementar transferências entre empresas (se necessário)

---

## 7. Considerações de Performance

### 7.1 Índices Necessários

Todas as tabelas com `companyId` precisarão de índices compostos:

```sql
-- Exemplo para products
CREATE INDEX idx_products_company_active ON products(companyId, active);
CREATE INDEX idx_products_company_category ON products(companyId, categoryId);

-- Exemplo para sales
CREATE INDEX idx_sales_company_date ON sales(companyId, saleDate);
CREATE INDEX idx_sales_company_status ON sales(companyId, status);
```

### 7.2 Particionamento (Futuro)

Se o volume de dados crescer significativamente, considerar particionamento por `companyId`:

```sql
ALTER TABLE sales PARTITION BY LIST (companyId) (
  PARTITION p_company_1 VALUES IN (1),
  PARTITION p_company_2 VALUES IN (2),
  -- ...
);
```

---

## 8. Segurança

### 8.1 Isolamento de Dados

- Todas as queries DEVEM incluir filtro por `companyId`
- Nunca confiar em `companyId` vindo do frontend
- Sempre extrair `companyId` do contexto autenticado do usuário

### 8.2 Auditoria

- Registrar em logs qual empresa foi acessada
- Registrar tentativas de acesso não autorizado
- Manter histórico de alterações de acesso

---

## 9. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Queries sem filtro de empresa | Alta | Crítico | Code review obrigatório, testes automatizados |
| Performance degradada | Média | Alto | Índices adequados, monitoramento |
| Migração incompleta | Média | Alto | Checklist de tabelas, testes de regressão |
| Conflito de dados | Baixa | Médio | Validações de unicidade por empresa |

---

## 10. Checklist de Implementação

### Pré-requisitos
- [ ] Módulo de Competência estabilizado
- [ ] Módulo de Fechamento estabilizado
- [ ] Módulo Contábil básico implementado
- [ ] Backup automático funcionando (✅ Concluído)

### Fase 1: Preparação
- [ ] Criar tabela `companies`
- [ ] Criar tabela `userCompanyAccess`
- [ ] Script de migração para adicionar `companyId`
- [ ] Script de preenchimento de dados existentes

### Fase 2: Código
- [ ] Migrar `server/db.ts` (31 tabelas)
- [ ] Migrar `server/routers.ts`
- [ ] Atualizar contexto de autenticação
- [ ] Implementar seletor de empresa no frontend

### Fase 3: Ativação
- [ ] Testes de regressão completos
- [ ] Alterar colunas para NOT NULL
- [ ] Criar índices de performance
- [ ] Documentar APIs atualizadas

### Fase 4: Consolidação
- [ ] Relatórios consolidados
- [ ] Dashboard multi-empresa
- [ ] Documentação de usuário

---

## 11. Estimativa de Esforço

| Fase | Esforço Estimado | Dependências |
|------|------------------|--------------|
| Fase 1: Preparação | 4-6 horas | Nenhuma |
| Fase 2: Código | 16-24 horas | Fase 1 |
| Fase 3: Ativação | 8-12 horas | Fase 2 + Testes |
| Fase 4: Consolidação | 8-16 horas | Fase 3 |
| **Total** | **36-58 horas** | - |

---

## 12. Conclusão

A arquitetura multiempresa proposta utiliza a estratégia de coluna discriminadora (`companyId`), que oferece o melhor equilíbrio entre simplicidade de implementação, facilidade de consolidação e custo de infraestrutura.

A implementação deve ser realizada **após** a estabilização dos módulos de competência, fechamento e contábil, garantindo que:

1. Não haja retrabalho em módulos em desenvolvimento
2. Novos módulos já nasçam com suporte multiempresa
3. A migração seja feita de forma controlada e testada

Este documento serve como guia de referência para quando a implementação for iniciada.

---

**Próximos Passos Recomendados:**
1. Estabilizar módulo de Competência
2. Estabilizar módulo de Fechamento
3. Implementar módulo Contábil básico
4. Revisar este documento antes de iniciar implementação
5. Criar branch específico para desenvolvimento multiempresa
