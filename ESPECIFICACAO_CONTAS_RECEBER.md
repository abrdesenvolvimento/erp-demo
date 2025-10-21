# Especificação: Módulo de Contas a Receber

## Objetivo
Gerenciar os recebimentos das vendas A Prazo, controlando parcelas, pagamentos e inadimplência.

## Estrutura de Dados

### 1. Receivables (Recebíveis)
Criados automaticamente quando uma venda A_PRAZO é registrada.

**Campos:**
- `id` - ID único
- `saleId` - ID da venda (FK para sales)
- `customerId` - ID do cliente (FK para partners)
- `totalAmount` - Valor total a receber (DECIMAL)
- `receivedAmount` - Valor já recebido (DECIMAL, default 0)
- `status` - Status: PENDENTE, PARCIAL, QUITADO, VENCIDO
- `createdAt` - Data de criação
- `createdBy` - Usuário que criou

### 2. ReceivableInstallments (Parcelas a Receber)
Parcelas individuais do recebível.

**Campos:**
- `id` - ID único
- `receivableId` - ID do recebível (FK)
- `installmentNumber` - Número da parcela (1, 2, 3...)
- `amount` - Valor da parcela (DECIMAL)
- `dueDate` - Data de vencimento (DATE)
- `paidDate` - Data do pagamento (DATE, nullable)
- `paidAmount` - Valor pago (DECIMAL, nullable)
- `paymentMethod` - Forma de pagamento (VARCHAR, nullable)
- `status` - Status: PENDENTE, PAGO, VENCIDO, PARCIAL
- `notes` - Observações (TEXT, nullable)

## Funcionalidades

### Backend (tRPC)

1. **receivables.list** - Listar recebíveis
   - Filtros: cliente, status, período
   - Ordenação: data de vencimento, valor

2. **receivables.get** - Obter recebível por ID
   - Retorna recebível com parcelas

3. **receivables.installments.pending** - Listar parcelas pendentes
   - Filtros: cliente, vencimento
   - Ordenação: data de vencimento

4. **receivables.installments.overdue** - Listar parcelas vencidas
   - Retorna parcelas com vencimento < hoje e status PENDENTE

5. **receivables.installments.pay** - Registrar pagamento de parcela
   - Parâmetros: installmentId, paidAmount, paidDate, paymentMethod, notes
   - Atualiza status da parcela e do recebível

6. **receivables.summary** - Resumo de recebíveis
   - Total a receber
   - Total vencido
   - Total recebido no período

### Frontend

**Página: Contas a Receber** (`/contas-receber`)

#### Seção 1: Cards de Resumo
- **A Receber**: Total de parcelas pendentes
- **Vencidas**: Total de parcelas vencidas (em vermelho)
- **Recebido Hoje**: Total recebido no dia

#### Seção 2: Abas
1. **Parcelas Pendentes**
   - Lista de parcelas a receber
   - Colunas: Cliente, Venda, Parcela, Valor, Vencimento, Dias (até/desde vencimento)
   - Botão "Receber" para cada parcela

2. **Parcelas Vencidas**
   - Lista de parcelas vencidas
   - Destaque em vermelho
   - Dias de atraso

3. **Histórico de Recebimentos**
   - Lista de parcelas pagas
   - Filtros: período, cliente

#### Modal: Registrar Recebimento
- Cliente (readonly)
- Venda (readonly)
- Parcela (readonly)
- Valor da Parcela (readonly)
- Data do Recebimento (date, default hoje)
- Valor Recebido (number, default valor da parcela)
- Forma de Pagamento (select)
- Observações (textarea)
- Botões: Cancelar, Confirmar Recebimento

## Integração com Vendas

Quando uma venda A_PRAZO é criada:
1. Criar registro em `receivables`
2. Criar parcelas em `receivableInstallments` baseado nas datas de vencimento

## Regras de Negócio

1. **Status de Parcela:**
   - PENDENTE: Não paga e não vencida
   - VENCIDO: Não paga e vencimento < hoje
   - PAGO: Valor pago = valor da parcela
   - PARCIAL: Valor pago < valor da parcela

2. **Status de Recebível:**
   - PENDENTE: Nenhuma parcela paga
   - PARCIAL: Algumas parcelas pagas
   - QUITADO: Todas as parcelas pagas
   - VENCIDO: Pelo menos uma parcela vencida

3. **Atualização Automática:**
   - Ao registrar pagamento, atualizar status da parcela
   - Recalcular status do recebível
   - Atualizar receivedAmount do recebível

## Formas de Pagamento
(Mesmas de Compras e Despesas)
- Boleto
- Crédito G
- Crédito R
- Crédito ABR
- À Vista
- Débito Automático
- PIX
- Dinheiro
- Cartão de Débito
- Cartão de Crédito
- Transferência

## Próximos Passos
1. Criar schema no banco de dados
2. Implementar funções no db.ts
3. Criar rotas tRPC
4. Desenvolver interface frontend
5. Testar integração com vendas A_PRAZO

