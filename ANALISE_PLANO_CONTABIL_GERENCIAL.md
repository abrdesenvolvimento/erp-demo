# Análise: Plano Contábil, Gerencial e Modelo DRE - ABRWF

**Data:** 15 de janeiro de 2026  
**Arquivo:** PlanoContábileGerencialABRWF.xlsx  
**Status:** Análise Completa

---

## Resumo Executivo

O arquivo fornecido contém uma estrutura contábil e gerencial bem definida com **50 contas gerenciais** mapeadas para um **plano contábil de 3 dígitos**. O modelo DRE está estruturado em 4 níveis: Receita Bruta → Receita Líquida → Lucro Bruto → Resultado Operacional.

**Achados Principais:**
- ✅ Plano contábil bem estruturado (códigos 3.x.xx.xxx)
- ✅ Mapeamento claro entre contas gerenciais e contábeis
- ✅ DRE com estrutura padrão de negócio
- ⚠️ **CRÍTICO:** Plano atual contempla APENAS despesas e custos, faltam receitas e entradas de estoque
- ⚠️ Necessário criar estrutura para receitas, devoluções e movimentação de estoque

---

## 1. Estrutura Atual do Plano Contábil

### 1.1 Hierarquia de Códigos

O plano utiliza estrutura de 4 níveis: `X.X.XX.XXX`

```
3.1.01.xxx - Custos Operacionais (Variáveis)
3.2.01.xxx - Despesas Operacionais (Fixas)
3.3.01.xxx - Despesas Administrativas
3.4.01.xxx - Despesas Financeiras (não mapeado ainda)
```

### 1.2 Contas Mapeadas

**Custos Operacionais (13 contas):**
- Energia Elétrica, Água, Gás, Fretes, Embalagens
- Material de Limpeza, Material de Consumo
- Manutenção de Equipamentos, Aluguel de Equipamentos
- Terceirização, PJ, Perdas de Estoque, Perdas Operacionais

**Despesas Operacionais (8 contas):**
- Aluguel, Seguros, Telefonia, Link, Segurança
- Serviço de Limpeza, Copa e Limpeza, Propaganda

**Despesas Administrativas (8+ contas):**
- Software, Consultoria, Marcas, Treinamento
- RH, Viagens, Material de Escritório, Reembolsos

**Despesas Financeiras e Outras (21 contas):**
- Salários, FGTS, INSS, IR/CSLL
- Juros, Despesa Bancária, Vale Transporte, Vale Refeição
- Imobilizados, Patrimonial, etc.

---

## 2. Modelo DRE Atual

### 2.1 Estrutura

```
RECEITA BRUTA
├─ Receita de Vendas
└─ (-) Deduções da Receita

RECEITA LÍQUIDA

(-) CUSTOS OPERACIONAIS
├─ Energia, Água, Gás, Fretes, Embalagens
├─ Material de Limpeza, Consumo
├─ Manutenção, Aluguel de Equipamentos
├─ Terceirização/PJ
└─ Perdas (Estoque e Operacionais)

LUCRO BRUTO

(-) DESPESAS OPERACIONAIS
├─ Aluguel, Seguros, Telefonia
├─ Link, Segurança, Limpeza
└─ Propaganda

(-) DESPESAS ADMINISTRATIVAS
├─ Software, Consultoria, Marcas
├─ Treinamento, RH, Viagens
└─ Material, Reembolsos

RESULTADO OPERACIONAL
```

### 2.2 Análise de Completude

| Seção | Status | Observação |
|-------|--------|-----------|
| Receita Bruta | ⚠️ Incompleta | Apenas "Receita de Vendas" + "Deduções" |
| Custos Operacionais | ✅ Completa | 13 contas bem mapeadas |
| Despesas Operacionais | ✅ Completa | 8 contas bem mapeadas |
| Despesas Administrativas | ✅ Completa | 8+ contas bem mapeadas |
| Despesas Financeiras | ⚠️ Não estruturada | Juros, IR/CSLL não aparecem no DRE |

---

## 3. Lacunas Identificadas

### 3.1 Receitas (CRÍTICO)

**Faltam no Plano Contábil:**
- Receita de Vendas (por canal: Balcão, Delivery, A Prazo)
- Receita de Serviços (se aplicável)
- Outras Receitas (Juros, Aluguel de espaço, etc.)
- Devoluções e Abatimentos

**Impacto:** Impossível gerar DRE completo sem mapeamento de receitas

### 3.2 Movimentação de Estoque (CRÍTICO)

**Faltam no Plano Contábil:**
- Entrada de Estoque (Compras)
- Saída de Estoque (Vendas)
- Ajustes de Estoque
- Controle de Custo de Mercadoria Vendida (CMV)

**Impacto:** Impossível calcular Lucro Bruto corretamente

### 3.3 Contas Patrimoniais (IMPORTANTE)

**Faltam no Plano Contábil:**
- Ativo Circulante (Caixa, Bancos, Contas a Receber, Estoque)
- Ativo Não Circulante (Imobilizado)
- Passivo Circulante (Contas a Pagar, Empréstimos)
- Patrimônio Líquido

**Impacto:** Sem balanço patrimonial, apenas DRE

---

## 4. Estrutura Proposta para Expansão

### 4.1 Plano Contábil Expandido

```
1.x.xx.xxx - ATIVO
├─ 1.1.01.xxx - Caixa e Bancos
├─ 1.2.01.xxx - Contas a Receber
├─ 1.3.01.xxx - Estoque
└─ 1.4.01.xxx - Imobilizado

2.x.xx.xxx - PASSIVO
├─ 2.1.01.xxx - Contas a Pagar
├─ 2.2.01.xxx - Empréstimos
└─ 2.3.01.xxx - Obrigações Fiscais

3.x.xx.xxx - RECEITAS E CUSTOS
├─ 3.1.01.xxx - Custos Operacionais (ATUAL)
├─ 3.2.01.xxx - Despesas Operacionais (ATUAL)
├─ 3.3.01.xxx - Despesas Administrativas (ATUAL)
├─ 3.4.01.xxx - Receitas de Vendas (NOVO)
├─ 3.5.01.xxx - Devoluções e Abatimentos (NOVO)
└─ 3.6.01.xxx - Outras Receitas (NOVO)

4.x.xx.xxx - PATRIMÔNIO LÍQUIDO
├─ 4.1.01.xxx - Capital Social
└─ 4.2.01.xxx - Lucros Acumulados
```

### 4.2 Receitas - Estrutura Proposta

```
3.4.01.001 - Receita de Vendas - Balcão
3.4.01.002 - Receita de Vendas - Delivery
3.4.01.003 - Receita de Vendas - A Prazo
3.4.01.004 - Receita de Serviços

3.5.01.001 - Devoluções de Vendas - Balcão
3.5.01.002 - Devoluções de Vendas - Delivery
3.5.01.003 - Devoluções de Vendas - A Prazo
3.5.01.004 - Abatimentos e Descontos

3.6.01.001 - Juros Recebidos
3.6.01.002 - Aluguel de Espaço
3.6.01.003 - Outras Receitas
```

### 4.3 Estoque - Estrutura Proposta

```
3.7.01.001 - Compras de Estoque
3.7.01.002 - Fretes de Compra (já existe como custo)
3.7.01.003 - Impostos sobre Compras (ICMS, PIS, COFINS)

3.8.01.001 - Devoluções de Compras
3.8.01.002 - Abatimentos de Compras

3.9.01.001 - Custo de Mercadoria Vendida (CMV)
3.9.01.002 - Ajustes de Estoque
```

---

## 5. Mapeamento Proposto no Sistema ERP

### 5.1 Tabelas Necessárias

**Tabela: `accountingMappings` (Nova)**
```sql
CREATE TABLE accountingMappings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  accountingCode VARCHAR(20) NOT NULL,           -- 3.1.01.001
  accountingName VARCHAR(100) NOT NULL,          -- Energia Elétrica
  managementAccount VARCHAR(100) NOT NULL,       -- Energia Elétrica
  nature ENUM('Custo', 'Despesa', 'Receita', 'Patrimonial'),
  type ENUM('Fixa', 'Variável', 'N/A'),
  classification VARCHAR(50),                    -- Operacional, Administrativa
  impactsMargin BOOLEAN,                         -- Sim/Não
  isAllowable BOOLEAN,                           -- Rateável
  createdAt TIMESTAMP DEFAULT NOW()
);
```

**Tabela: `revenueAccounts` (Nova)**
```sql
CREATE TABLE revenueAccounts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  accountingCode VARCHAR(20) NOT NULL,
  channelId INT,                                 -- FK para salesChannels
  description VARCHAR(100),
  createdAt TIMESTAMP DEFAULT NOW()
);
```

**Tabela: `inventoryAccounts` (Nova)**
```sql
CREATE TABLE inventoryAccounts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  accountingCode VARCHAR(20) NOT NULL,
  type ENUM('ENTRADA', 'SAIDA', 'AJUSTE', 'CMV'),
  description VARCHAR(100),
  createdAt TIMESTAMP DEFAULT NOW()
);
```

### 5.2 Fluxo de Integração

**Despesas (Atual - Funcionando):**
```
Despesa criada → Categoria Gerencial → Conta Contábil (3.x.xx.xxx) → DRE
```

**Receitas (Novo - Necessário):**
```
Venda criada → Canal de Venda → Conta Contábil Receita (3.4.01.xxx) → DRE
```

**Estoque (Novo - Necessário):**
```
Compra criada → Conta Contábil Compra (3.7.01.xxx)
Venda criada → CMV calculado → Conta Contábil CMV (3.9.01.001)
```

---

## 6. Priorização de Implementação

### Fase 1: Mapeamento Contábil (IMEDIATO - 1 semana)

**Objetivo:** Integrar o plano contábil atual ao sistema

1. ✅ Criar tabela `accountingMappings`
2. ✅ Importar 50 contas gerenciais do arquivo Excel
3. ✅ Mapear contas existentes de despesas
4. ✅ Testar geração de DRE com dados atuais

**Esforço:** 8 horas  
**Impacto:** Permite rastreamento contábil de despesas

### Fase 2: Receitas (ALTA PRIORIDADE - 1-2 semanas)

**Objetivo:** Mapear receitas de vendas por canal

1. Criar tabela `revenueAccounts`
2. Adicionar contas contábeis para receitas (3.4.01.xxx)
3. Modificar endpoint de vendas para registrar conta contábil
4. Implementar cálculo de receita líquida (receita - deduções)

**Esforço:** 12 horas  
**Impacto:** DRE com receita completa

### Fase 3: Estoque e CMV (ALTA PRIORIDADE - 2-3 semanas)

**Objetivo:** Rastrear custo de mercadoria vendida

1. Criar tabela `inventoryAccounts`
2. Adicionar contas contábeis para compras e CMV
3. Implementar cálculo de CMV na venda
4. Implementar cálculo de Lucro Bruto

**Esforço:** 16 horas  
**Impacto:** DRE com Lucro Bruto correto

### Fase 4: Contas Patrimoniais (MÉDIA PRIORIDADE - 3-4 semanas)

**Objetivo:** Gerar balanço patrimonial

1. Criar estrutura de contas patrimoniais (1.x, 2.x, 4.x)
2. Integrar com movimentação de caixa
3. Integrar com contas a receber/pagar
4. Gerar balanço patrimonial

**Esforço:** 20 horas  
**Impacto:** Relatórios financeiros completos

---

## 7. Recomendações Imediatas

### 7.1 Antes de Implementar

**IMPORTANTE:** O plano atual está bem estruturado, mas **incompleto**. Recomendo:

1. **Confirmar com contador:** Validar se a estrutura proposta está alinhada com o plano contábil real
2. **Definir período:** Quando começar a usar o novo plano? Retroativamente?
3. **Migração de dados:** Como migrar despesas já lançadas para novo plano?

### 7.2 Próximos Passos

**Hoje:**
- [ ] Revisar e confirmar estrutura do plano contábil
- [ ] Validar se há outras receitas além de vendas
- [ ] Definir se precisa de controle de estoque por lote (para validade)

**Esta Semana:**
- [ ] Criar tabela `accountingMappings` e importar dados
- [ ] Adicionar campos de mapeamento contábil às tabelas existentes
- [ ] Testar geração de DRE com dados atuais

**Próximas 2 Semanas:**
- [ ] Implementar receitas (Fase 2)
- [ ] Implementar estoque e CMV (Fase 3)

---

## 8. Resposta às Perguntas do Usuário

### P1: "Seria necessário criarmos para receitas e entradas em estoque?"

**Resposta:** SIM, é CRÍTICO. O plano atual contempla APENAS despesas e custos. Para um DRE completo e correto, você precisa de:

1. **Receitas:** Mapeamento de vendas por canal (Balcão, Delivery, A Prazo)
2. **Deduções:** Devoluções, abatimentos, impostos sobre vendas
3. **Estoque:** Compras, CMV, ajustes
4. **Patrimonial:** Caixa, contas a receber, estoque (ativo) e contas a pagar (passivo)

Sem isso, o DRE mostrará apenas custos e despesas, sem receita. O resultado será sempre negativo.

### P2: "O ideal é olharmos essa parte com certa prioridade enquanto temos poucas despesas lançadas?"

**Resposta:** SIM, ABSOLUTAMENTE. Este é o momento ideal porque:

1. ✅ Poucas despesas já lançadas (fácil migração)
2. ✅ Estrutura ainda está sendo definida
3. ✅ Não há dados históricos complexos para migrar
4. ✅ Depois fica muito mais difícil mudar

**Recomendação:** Pause as outras melhorias por 1-2 semanas e implemente o plano contábil agora.

---

## 9. Próxima Ação Recomendada

Sugiro que você:

1. **Confirme com seu contador** se a estrutura proposta está correta
2. **Defina o escopo completo** (receitas, estoque, patrimonial)
3. **Autorize a implementação** da Fase 1 (mapeamento contábil)

Depois disso, posso começar a implementação imediatamente.

---

**Documento preparado por:** Manus AI  
**Data:** 15 de janeiro de 2026  
**Próxima Revisão:** Após confirmação do escopo com contador
