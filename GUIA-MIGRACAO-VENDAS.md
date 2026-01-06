# Guia Rápido: Migração de Vendas Legadas

**Objetivo:** Importar histórico de vendas do Excel para o ERP

---

## 📋 Pré-requisitos

### 1. Preparar Planilha Excel

Sua planilha deve ter **exatamente** estas colunas (nomes devem ser idênticos):

| Coluna | Tipo | Exemplo |
|--------|------|---------|
| **Data** | Data | 15/03/2024 |
| **Item** | Texto | Coca Cola 2L |
| **Quantidade** | Número | 10 |
| **Valor Unitário** | Decimal | 8.50 |
| **Custo de Venda** | Decimal | 6.20 |

**Formato:** `.xlsx` (Excel)

### 2. Cadastrar Produtos no ERP

⚠️ **IMPORTANTE:** Todos os produtos da planilha devem estar cadastrados no ERP antes da migração.

**Como verificar:**
1. Acesse **Produtos** no menu
2. Confira se todos os produtos da coluna "Item" estão cadastrados
3. Os nomes devem ser **idênticos** (ou muito similares)

### 3. Fazer Backup

✅ **OBRIGATÓRIO:** Faça backup do banco de dados antes de iniciar.

```bash
# Exemplo de backup (ajuste conforme seu ambiente)
mysqldump -u usuario -p nome_banco > backup-antes-migracao.sql
```

---

## 🚀 Como Executar

### Passo 1: Instalar Dependência

```bash
cd /home/ubuntu/erp-demo
pnpm add xlsx
```

### Passo 2: Executar Script

```bash
node migrate-sales-from-excel.mjs /caminho/para/vendas-historicas.xlsx
```

**Exemplo:**
```bash
node migrate-sales-from-excel.mjs ~/Downloads/vendas-2020-2025.xlsx
```

### Passo 3: Acompanhar Execução

O script mostrará progresso em tempo real:

```
🚀 Iniciando migração de vendas legadas...

🔌 Conectando ao banco de dados...
✅ Conectado

📖 Lendo planilha: vendas-historicas.xlsx
✅ 15432 linhas encontradas

📊 Validando e processando dados...

  Processadas 100/15432 linhas...
  Processadas 200/15432 linhas...
  ...
```

---

## 📊 Resultados

### Relatório no Terminal

Ao final, você verá um resumo:

```
=== MIGRAÇÃO DE VENDAS LEGADAS ===
Data/Hora: 06/01/2026 14:30:00
Duração: 45.23s

--- RESUMO ---
Total de linhas: 15.432
Linhas processadas: 15.120
Linhas rejeitadas: 312
Taxa de sucesso: 97.98%

--- VENDAS CRIADAS ---
Total de vendas: 8.456
Total de itens: 15.120

--- VALORES ---
Faturamento Total: R$ 2.456.789,50
Custo Total: R$ 1.823.456,30
Margem Bruta: R$ 633.333,20 (25,8%)
```

### Arquivos de Log Gerados

O script cria automaticamente:

1. **migration-log-YYYYMMDD-HHmmss.txt**
   - Relatório completo da migração
   
2. **produtos-nao-encontrados-YYYYMMDD-HHmmss.csv**
   - Lista de produtos que não foram encontrados no ERP
   - Só é criado se houver produtos não encontrados
   
3. **erros-detalhados-YYYYMMDD-HHmmss.csv**
   - Detalhes de todas as linhas rejeitadas
   - Só é criado se houver erros

---

## ⚠️ Tratamento de Erros

### Produtos Não Encontrados

Se o script encontrar produtos que não existem no ERP:

1. **Pausar migração** (se taxa de erro > 5%)
2. Abrir arquivo `produtos-nao-encontrados-*.csv`
3. Cadastrar produtos faltantes no ERP
4. **Executar script novamente**

**Exemplo de produto não encontrado:**
```
Produto,Ocorrências
"Cerveja Skol Lata 350ml",45
"Refrigerante Guaraná 2L",23
```

**Solução:**
- Cadastrar produtos no ERP com nomes exatos
- OU ajustar nomes na planilha Excel
- OU ativar fuzzy matching (busca aproximada)

### Datas Inválidas

Formatos aceitos:
- ✅ `DD/MM/YYYY` (15/03/2024)
- ✅ `DD-MM-YYYY` (15-03-2024)
- ✅ `YYYY-MM-DD` (2024-03-15)
- ✅ Serial do Excel (número)

Se houver erro de data:
1. Verificar formato na planilha
2. Corrigir células com erro
3. Executar script novamente

### Valores Negativos

- Quantidade negativa → ❌ Rejeitada
- Preço negativo → ❌ Rejeitada
- Custo negativo → ⚠️ Convertido para 0

---

## 🔍 Validações Pós-Migração

### 1. Conferir Total de Vendas

```sql
SELECT COUNT(*) as total_vendas_migradas
FROM sales
WHERE status = 'Migração de Dados';
```

### 2. Validar Faturamento

```sql
SELECT 
  SUM(totalAmount) as faturamento_total,
  SUM(finalAmount) as faturamento_final
FROM sales
WHERE status = 'Migração de Dados';
```

Compare com o total da planilha Excel.

### 3. Verificar Produtos Mais Vendidos

Acesse **Análise de Vendas** no ERP e confira se os dados históricos aparecem corretamente.

### 4. Testar Relatórios

- Dashboard → Deve incluir vendas migradas
- Análise de Vendas → Filtrar por período histórico
- Produtos Mais Vendidos → Verificar ranking

---

## ❓ Perguntas Frequentes

### O estoque será atualizado?

**Não.** Vendas migradas são históricas e **não afetam o estoque atual**.

### Serão criadas contas a receber?

**Não.** Vendas migradas são consideradas já pagas.

### Posso executar o script múltiplas vezes?

**Sim**, mas cuidado com duplicatas. O script tenta evitar duplicatas, mas é recomendado:
1. Fazer backup antes de cada execução
2. Revisar logs de execuções anteriores
3. Limpar vendas migradas se necessário:

```sql
DELETE FROM sales WHERE status = 'Migração de Dados';
```

### Como identificar vendas migradas?

Todas as vendas migradas têm:
- `status = 'Migração de Dados'`
- `paymentMethod = 'Migração de Dados'`
- `saleType = 'BALCAO'`
- `customerId = NULL`
- `createdBy = 'migration-script'`

### E se houver erro no meio da migração?

O script processa linha por linha. Se houver erro:
1. Vendas já inseridas permanecem no banco
2. Linha com erro é rejeitada e registrada no log
3. Script continua processando próximas linhas

Para recomeçar do zero:
```sql
DELETE FROM sales WHERE status = 'Migração de Dados';
```

---

## 🛠️ Configurações Avançadas

### Ativar Fuzzy Matching

Se nomes de produtos na planilha não são exatos, edite o script:

```javascript
behavior: {
  fuzzyMatch: true,        // ← Já está ativo
  fuzzyThreshold: 0.9      // ← 90% de similaridade
}
```

### Ajustar Threshold de Erros

Para pausar migração se taxa de erro for alta:

```javascript
validation: {
  errorThreshold: 0.05     // ← 5% de erros (padrão)
}
```

### Alterar Hora Padrão

Vendas sem horário usam 12:00:00 por padrão:

```javascript
defaults: {
  defaultTime: '12:00:00'  // ← Alterar se necessário
}
```

---

## 📞 Suporte

**Em caso de dúvidas:**

1. Consultar documento: `DE-PARA-MIGRACAO-VENDAS.md`
2. Verificar logs de migração
3. Contatar suporte técnico

**Arquivos importantes:**
- `DE-PARA-MIGRACAO-VENDAS.md` → Documentação completa
- `migrate-sales-from-excel.mjs` → Script de migração
- `GUIA-MIGRACAO-VENDAS.md` → Este guia

---

## ✅ Checklist de Execução

Antes de executar:
- [ ] Planilha Excel com colunas corretas
- [ ] Todos os produtos cadastrados no ERP
- [ ] Backup do banco de dados realizado
- [ ] Dependência `xlsx` instalada (`pnpm add xlsx`)

Durante a execução:
- [ ] Monitorar logs em tempo real
- [ ] Verificar se taxa de erro está baixa
- [ ] Pausar se houver problemas críticos

Após a execução:
- [ ] Conferir relatório de migração
- [ ] Revisar produtos não encontrados
- [ ] Validar faturamento total
- [ ] Testar relatórios no ERP
- [ ] Arquivar logs e planilha original

---

**Última atualização:** 06/01/2026  
**Versão:** 1.0
