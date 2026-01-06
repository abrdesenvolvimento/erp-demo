# De-Para: Migração de Vendas Legadas (Excel → ERP)

**Data:** 06/01/2026  
**Objetivo:** Importar histórico de vendas do sistema legado (Excel) para o novo ERP

---

## 1. Estrutura de Origem (Excel)

### Planilha: Vendas Históricas
**Formato:** `.xlsx`

| Coluna Excel | Tipo | Exemplo | Observações |
|--------------|------|---------|-------------|
| **Data** | Data | 15/03/2024 | Data original da venda |
| **Item** | Texto | "Coca Cola 2L" | Nome do produto vendido |
| **Quantidade** | Número | 10 | Quantidade vendida |
| **Valor Unitário** | Decimal | 8.50 | Preço unitário do produto |
| **Custo de Venda** | Decimal | 6.20 | Custo unitário na data da venda |

---

## 2. Estrutura de Destino (ERP)

### Tabela: `sales` (Vendas)

| Campo ERP | Tipo | Origem | Transformação | Valor Padrão |
|-----------|------|--------|---------------|--------------|
| `id` | INT | - | Auto-incremento | - |
| `saleDate` | DATETIME | Excel: Data | Converter para YYYY-MM-DD HH:mm:ss | Hora: 12:00:00 |
| `saleType` | ENUM | - | Fixo | **"BALCAO"** |
| `customerId` | INT | - | NULL | **NULL** (sem cliente) |
| `paymentMethod` | VARCHAR | - | Fixo | **"Migração de Dados"** |
| `status` | ENUM | - | Fixo | **"Migração de Dados"** |
| `totalAmount` | DECIMAL | Calculado | Quantidade × Valor Unitário | - |
| `finalAmount` | DECIMAL | Calculado | = totalAmount | - |
| `createdBy` | VARCHAR | - | Fixo | **"migration-script"** |
| `createdAt` | DATETIME | - | Data da migração | NOW() |

### Tabela: `saleItems` (Itens de Venda)

| Campo ERP | Tipo | Origem | Transformação | Valor Padrão |
|-----------|------|--------|---------------|--------------|
| `id` | INT | - | Auto-incremento | - |
| `saleId` | INT | - | FK da venda criada | - |
| `productId` | INT | Excel: Item | **Lookup via De-Para** | - |
| `quantity` | DECIMAL | Excel: Quantidade | Direto | - |
| `unitPrice` | DECIMAL | Excel: Valor Unitário | Direto | - |
| `unitCost` | DECIMAL | Excel: Custo de Venda | Direto | - |
| `totalPrice` | DECIMAL | Calculado | Quantidade × Valor Unitário | - |
| `totalCost` | DECIMAL | Calculado | Quantidade × Custo de Venda | - |

---

## 3. Mapeamento de Produtos (De-Para)

### Regras de Matching

1. **Busca Exata:** Comparar nome do Excel com `products.name` (case-insensitive)
2. **Busca por EAN:** Se disponível no De-Para, usar `products.ean`
3. **Busca Fuzzy:** Similaridade > 90% usando Levenshtein distance
4. **Fallback:** Criar log de produtos não encontrados para revisão manual

### Exemplo de De-Para

| Nome Excel | Nome ERP | Product ID | Ação |
|------------|----------|------------|------|
| Coca Cola 2L | Coca Cola 2l Retornável | 123 | Match exato |
| Skol Lata | Skol Lata 350ml | 456 | Match parcial |
| Produto X | - | - | ⚠️ Não encontrado |

**Nota:** O usuário informou que já fez o De-Para considerando a coluna "Item" com os nomes dos produtos que serão cadastrados no sistema.

---

## 4. Regras de Validação

### Validações Obrigatórias

| Validação | Regra | Ação em Caso de Falha |
|-----------|-------|----------------------|
| **Data válida** | Data entre 2020-01-01 e hoje | ❌ Rejeitar linha |
| **Produto existe** | productId encontrado no banco | ❌ Rejeitar linha + log |
| **Quantidade > 0** | Quantidade deve ser positiva | ❌ Rejeitar linha |
| **Valor Unitário > 0** | Preço deve ser positivo | ❌ Rejeitar linha |
| **Custo de Venda ≥ 0** | Custo pode ser zero (doação) | ⚠️ Aceitar com warning |

### Validações de Integridade

- ✅ Não criar duplicatas (mesma data + produto + quantidade)
- ✅ Verificar se produto está ativo no sistema
- ✅ Validar se custo não é maior que preço (warning, não bloqueia)

---

## 5. Tratamento de Casos Especiais

### 5.1. Produtos Não Encontrados

**Ação:** Criar arquivo `produtos-nao-encontrados.csv` com:
- Nome do produto no Excel
- Quantidade de ocorrências
- Total de vendas afetadas

**Processo:**
1. Pausar migração
2. Revisar lista com usuário
3. Cadastrar produtos faltantes ou ajustar De-Para
4. Retomar migração

### 5.2. Datas Inválidas

**Ação:** Converter formatos comuns:
- `DD/MM/YYYY` → `YYYY-MM-DD`
- `DD-MM-YYYY` → `YYYY-MM-DD`
- Texto "15 de março de 2024" → `2024-03-15`

Se conversão falhar: rejeitar linha + log

### 5.3. Valores Negativos

**Ação:** 
- Quantidade negativa → ❌ Rejeitar
- Valor negativo → ❌ Rejeitar
- Custo negativo → ⚠️ Converter para 0 + warning

---

## 6. Impactos no Sistema

### 6.1. Estoque

**⚠️ IMPORTANTE:** Vendas migradas **NÃO devem** dar baixa no estoque atual.

**Motivo:** São vendas históricas, o estoque já foi consumido no passado.

**Implementação:** Flag `isHistorical = true` ou pular lógica de baixa de estoque.

### 6.2. Financeiro

**Contas a Receber:** Não criar títulos (vendas já foram pagas no passado)

**Fluxo de Caixa:** Vendas migradas aparecem em relatórios históricos, mas não afetam saldo atual.

### 6.3. Relatórios e Análises

**Incluir em:**
- ✅ Análise de Vendas por período
- ✅ Produtos mais vendidos (histórico completo)
- ✅ Margem de lucro histórica
- ✅ Evolução de vendas (comparativo ano a ano)

**Filtro:** Adicionar opção "Incluir vendas migradas" nos relatórios.

---

## 7. Processo de Migração

### Etapa 1: Preparação

1. ✅ Backup completo do banco de dados
2. ✅ Validar estrutura da planilha Excel
3. ✅ Conferir De-Para de produtos (todos cadastrados?)
4. ✅ Criar tabela temporária `sales_migration_temp`

### Etapa 2: Validação

1. ✅ Ler planilha Excel completa
2. ✅ Validar cada linha (regras da seção 4)
3. ✅ Gerar relatório de validação:
   - Total de linhas
   - Linhas válidas
   - Linhas com erro
   - Produtos não encontrados

### Etapa 3: Importação

1. ✅ Inserir vendas na tabela `sales`
2. ✅ Inserir itens na tabela `saleItems`
3. ✅ **NÃO** atualizar estoque
4. ✅ **NÃO** criar contas a receber
5. ✅ Gerar log de importação

### Etapa 4: Validação Pós-Migração

1. ✅ Conferir total de vendas importadas
2. ✅ Validar soma de valores (Excel vs ERP)
3. ✅ Verificar integridade referencial
4. ✅ Testar relatórios com dados migrados

---

## 8. Logs e Auditoria

### Arquivo: `migration-log-YYYYMMDD-HHmmss.txt`

```
=== MIGRAÇÃO DE VENDAS LEGADAS ===
Data/Hora: 06/01/2026 14:30:00
Arquivo: vendas-historicas.xlsx

--- RESUMO ---
Total de linhas: 15.432
Linhas processadas: 15.120
Linhas rejeitadas: 312

--- VENDAS CRIADAS ---
Total de vendas: 8.456
Total de itens: 15.120
Período: 01/01/2020 a 31/12/2025

--- VALORES ---
Faturamento Total: R$ 2.456.789,50
Custo Total: R$ 1.823.456,30
Margem Bruta: R$ 633.333,20 (25,8%)

--- PRODUTOS NÃO ENCONTRADOS ---
- "Cerveja X": 45 ocorrências
- "Refrigerante Y": 23 ocorrências
(Ver arquivo: produtos-nao-encontrados.csv)

--- ERROS ---
- Data inválida: 12 linhas
- Quantidade negativa: 8 linhas
- Produto não encontrado: 292 linhas
(Ver arquivo: erros-detalhados.csv)
```

---

## 9. Checklist de Execução

### Antes da Migração

- [ ] Backup do banco de dados realizado
- [ ] Planilha Excel validada (formato correto)
- [ ] Todos os produtos do De-Para cadastrados no ERP
- [ ] Script de migração testado em ambiente de desenvolvimento
- [ ] Usuário ciente de que processo pode levar alguns minutos

### Durante a Migração

- [ ] Monitorar logs em tempo real
- [ ] Verificar se há erros críticos
- [ ] Pausar se taxa de erro > 5%

### Após a Migração

- [ ] Conferir total de vendas importadas
- [ ] Validar relatórios (Análise de Vendas, Dashboard)
- [ ] Revisar produtos não encontrados
- [ ] Documentar lições aprendidas
- [ ] Arquivar planilha original + logs

---

## 10. Contatos e Suporte

**Responsável pela Migração:** Sistema Automático  
**Validação de Dados:** Usuário (Gabriel)  
**Suporte Técnico:** Equipe de Desenvolvimento

**Em caso de dúvidas:**
1. Consultar este documento
2. Verificar logs de migração
3. Contatar suporte técnico

---

## 11. Anexos

### A. Exemplo de Linha Excel

```
Data: 15/03/2024
Item: Coca Cola 2L
Quantidade: 10
Valor Unitário: 8.50
Custo de Venda: 6.20
```

### B. SQL Gerado (Exemplo)

```sql
-- Venda
INSERT INTO sales (saleDate, saleType, customerId, paymentMethod, status, totalAmount, finalAmount, createdBy)
VALUES ('2024-03-15 12:00:00', 'BALCAO', NULL, 'Migração de Dados', 'Migração de Dados', 85.00, 85.00, 'migration-script');

-- Item
INSERT INTO saleItems (saleId, productId, quantity, unitPrice, unitCost, totalPrice, totalCost)
VALUES (LAST_INSERT_ID(), 123, 10, 8.50, 6.20, 85.00, 62.00);
```

### C. Estrutura da Planilha Excel Esperada

```
| Data       | Item          | Quantidade | Valor Unitário | Custo de Venda |
|------------|---------------|------------|----------------|----------------|
| 15/03/2024 | Coca Cola 2L  | 10         | 8.50           | 6.20           |
| 16/03/2024 | Skol Lata     | 24         | 3.20           | 2.10           |
| ...        | ...           | ...        | ...            | ...            |
```

---

**Documento criado em:** 06/01/2026  
**Última atualização:** 06/01/2026  
**Versão:** 1.0
