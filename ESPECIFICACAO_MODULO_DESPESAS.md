# Especificação do Módulo de Despesas Operacionais

## 📋 Visão Geral

O módulo de **Despesas Operacionais** será responsável por registrar e gerenciar todas as despesas da empresa que não estão relacionadas diretamente à compra de mercadorias (que já são gerenciadas pelo módulo de Compras).

## 🎯 Objetivos

1. Registrar despesas operacionais da empresa
2. Categorizar despesas para análise e relatórios
3. Controlar pagamentos (à vista ou parcelado)
4. Integrar com o Fluxo de Caixa
5. Gerar relatórios de despesas por período e categoria

## 📊 Estrutura de Dados

### Tabela: `expenseCategories` (Categorias de Despesas)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INT | ID único da categoria |
| name | VARCHAR(100) | Nome da categoria |
| description | TEXT | Descrição da categoria |
| active | BOOLEAN | Se a categoria está ativa |
| createdAt | TIMESTAMP | Data de criação |
| updatedAt | TIMESTAMP | Data de atualização |

**Categorias Padrão:**
- Aluguel
- Energia Elétrica
- Água
- Telefone/Internet
- Salários e Encargos
- Contador
- Manutenção
- Limpeza
- Segurança
- Marketing e Publicidade
- Taxas e Impostos
- Material de Escritório
- Transporte/Combustível
- Outras Despesas

### Tabela: `expenses` (Despesas)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INT | ID único da despesa |
| categoryId | INT | FK para categoria |
| description | VARCHAR(255) | Descrição da despesa |
| totalAmount | DECIMAL(10,2) | Valor total da despesa |
| paymentType | ENUM | 'AVISTA' ou 'PARCELADO' |
| installments | INT | Número de parcelas (se parcelado) |
| dueDay | INT | Dia do vencimento (1-31) |
| firstDueDate | DATE | Data do primeiro vencimento |
| supplierId | INT | FK para fornecedor (opcional) |
| notes | TEXT | Observações |
| status | ENUM | 'ATIVA', 'CANCELADA' |
| createdAt | TIMESTAMP | Data de criação |
| updatedAt | TIMESTAMP | Data de atualização |

### Tabela: `expenseInstallments` (Parcelas de Despesas)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INT | ID único da parcela |
| expenseId | INT | FK para despesa |
| installmentNumber | INT | Número da parcela (1, 2, 3...) |
| amount | DECIMAL(10,2) | Valor da parcela |
| dueDate | DATE | Data de vencimento |
| paymentDate | DATE | Data do pagamento (NULL se não pago) |
| paymentAmount | DECIMAL(10,2) | Valor pago |
| paymentMethod | ENUM | 'DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'TRANSFERENCIA', 'BOLETO' |
| status | ENUM | 'PENDENTE', 'PAGO', 'VENCIDO', 'CANCELADO' |
| notes | TEXT | Observações sobre o pagamento |
| createdAt | TIMESTAMP | Data de criação |
| updatedAt | TIMESTAMP | Data de atualização |

## 🔄 Fluxos de Trabalho

### 1. Cadastro de Despesa à Vista

1. Usuário seleciona categoria
2. Preenche descrição e valor
3. Seleciona "À Vista"
4. Define data de vencimento
5. Sistema cria:
   - 1 registro em `expenses`
   - 1 registro em `expenseInstallments` (status PENDENTE)

### 2. Cadastro de Despesa Parcelada

1. Usuário seleciona categoria
2. Preenche descrição e valor total
3. Seleciona "Parcelado"
4. Define número de parcelas
5. Define dia do vencimento (ex: dia 10 de cada mês)
6. Define data do primeiro vencimento
7. Sistema cria:
   - 1 registro em `expenses`
   - N registros em `expenseInstallments` (um para cada parcela)
   - Calcula automaticamente as datas de vencimento

### 3. Pagamento de Parcela

1. Usuário acessa lista de parcelas pendentes
2. Seleciona parcela a pagar
3. Informa:
   - Data do pagamento
   - Valor pago (pode ser diferente do valor da parcela)
   - Forma de pagamento
   - Observações (opcional)
4. Sistema atualiza:
   - Status da parcela para PAGO
   - Registra informações do pagamento
   - Atualiza fluxo de caixa

### 4. Cancelamento de Despesa

1. Usuário seleciona despesa
2. Confirma cancelamento
3. Sistema:
   - Marca despesa como CANCELADA
   - Cancela todas as parcelas PENDENTES
   - Mantém histórico de parcelas já pagas

## 🎨 Interface do Usuário

### Tela Principal: Lista de Despesas

**Filtros:**
- Categoria
- Status (Ativa/Cancelada)
- Período
- Tipo de pagamento

**Colunas da tabela:**
- Categoria
- Descrição
- Valor Total
- Tipo (À Vista/Parcelado)
- Parcelas (ex: "3/12 pagas")
- Próximo Vencimento
- Status
- Ações (Ver, Editar, Cancelar)

**Botões de ação:**
- "+ Nova Despesa"
- "Parcelas Pendentes" (badge com contador)
- "Exportar Relatório"

### Modal: Nova Despesa / Editar Despesa

**Campos:**
- Categoria (select)
- Descrição (text)
- Fornecedor (select, opcional)
- Valor Total (number)
- Tipo de Pagamento (radio: À Vista / Parcelado)

**Se À Vista:**
- Data de Vencimento (date)

**Se Parcelado:**
- Número de Parcelas (number)
- Dia do Vencimento (select: 1-31)
- Data do Primeiro Vencimento (date)

- Observações (textarea)

### Tela: Parcelas Pendentes

**Filtros:**
- Categoria
- Período de vencimento
- Status (Pendente/Vencido)

**Colunas:**
- Despesa (descrição)
- Parcela (ex: "3/12")
- Valor
- Vencimento
- Dias (até vencer ou em atraso)
- Status
- Ações (Pagar)

### Modal: Registrar Pagamento

**Campos:**
- Despesa (readonly)
- Parcela (readonly)
- Valor da Parcela (readonly)
- Data do Pagamento (date, default: hoje)
- Valor Pago (number, default: valor da parcela)
- Forma de Pagamento (select)
- Observações (textarea, opcional)

## 📊 Relatórios

### 1. Despesas por Categoria
- Gráfico de pizza/barras
- Período selecionável
- Valores e percentuais

### 2. Despesas por Período
- Gráfico de linha/barras
- Comparação mês a mês
- Total pago vs pendente

### 3. Fluxo de Caixa
- Integração com Contas a Receber e Compras
- Entradas vs Saídas
- Projeção de pagamentos futuros

## 🔗 Integrações

### Com Módulo de Parceiros
- Vincular despesas a fornecedores cadastrados
- Histórico de despesas por fornecedor

### Com Fluxo de Caixa (futuro)
- Registrar saídas quando parcelas são pagas
- Projetar pagamentos futuros

### Com Relatórios
- Análise de despesas
- DRE (Demonstrativo de Resultado do Exercício)

## ✅ Validações

1. **Categoria:** Obrigatória
2. **Descrição:** Obrigatória, mínimo 3 caracteres
3. **Valor Total:** Obrigatório, maior que zero
4. **Número de Parcelas:** Se parcelado, mínimo 2, máximo 60
5. **Dia do Vencimento:** Entre 1 e 31
6. **Data do Primeiro Vencimento:** Não pode ser anterior a hoje
7. **Valor Pago:** Deve ser maior que zero
8. **Data do Pagamento:** Não pode ser futura

## 🚀 Implementação

### Fase 1: Backend
1. Criar schemas no Drizzle ORM
2. Criar migrations
3. Implementar rotas tRPC:
   - `expenses.list`
   - `expenses.create`
   - `expenses.update`
   - `expenses.cancel`
   - `expenses.getById`
   - `expenseCategories.list`
   - `expenseCategories.create`
   - `expenseInstallments.list`
   - `expenseInstallments.pay`
   - `expenseInstallments.pending`

### Fase 2: Frontend
1. Criar página de Despesas
2. Criar componentes:
   - ExpenseList
   - ExpenseForm
   - InstallmentsList
   - PaymentForm
3. Integrar com tRPC
4. Adicionar validações

### Fase 3: Dados Iniciais
1. Popular categorias padrão
2. Criar dados de teste

### Fase 4: Testes
1. Testar criação de despesas à vista
2. Testar criação de despesas parceladas
3. Testar pagamento de parcelas
4. Testar cancelamento
5. Testar filtros e buscas

## 📝 Notas Técnicas

- Usar `DECIMAL(10,2)` para valores monetários
- Usar `ENUM` para tipos fixos (status, formas de pagamento)
- Criar índices em campos de busca frequente (categoryId, status, dueDate)
- Implementar soft delete para manter histórico
- Calcular automaticamente o status das parcelas (VENCIDO se dueDate < hoje e status = PENDENTE)

---

**Prioridade:** Alta  
**Dependências:** Módulo de Parceiros (fornecedores)  
**Próximo Módulo:** Contas a Receber

