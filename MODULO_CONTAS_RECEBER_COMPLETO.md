# Módulo de Contas a Receber - Documentação Completa

## 📋 Visão Geral

O **Módulo de Contas a Receber** gerencia os recebimentos das vendas A Prazo, permitindo controle completo de parcelas, pagamentos e inadimplência.

---

## ✅ Funcionalidades Implementadas

### 1. Dashboard de Recebíveis
- **A Receber**: Total de parcelas pendentes
- **Vencidas**: Total de parcelas em atraso
- **Recebido Hoje**: Total recebido no dia atual

### 2. Gestão de Parcelas Pendentes
- Listagem de todas as parcelas a receber
- Informações detalhadas:
  - Número da venda
  - Número da parcela
  - Valor da parcela
  - Data de vencimento
  - Dias até o vencimento
- Botão "Receber" para cada parcela

### 3. Gestão de Parcelas Vencidas
- Listagem separada de parcelas atrasadas
- Destaque visual (borda e fundo vermelho)
- Indicação de dias de atraso
- Botão "Receber" para regularização

### 4. Registro de Recebimentos
- Modal completo com:
  - Informações da venda e parcela
  - Data do recebimento
  - Valor recebido (permite recebimento parcial)
  - 11 formas de pagamento:
    - Dinheiro
    - PIX
    - Cartão de Débito
    - Cartão de Crédito
    - Transferência
    - Boleto
    - Crédito G
    - Crédito R
    - Crédito ABR
    - À Vista
    - Débito Automático
  - Campo de observações

### 5. Integração Automática com Vendas
- Criação automática de recebíveis ao registrar venda A_PRAZO
- Geração automática de parcelas com valores individuais
- Vínculo direto entre venda e recebível

### 6. Atualização Automática de Status
- Status do recebível atualizado automaticamente:
  - **PENDENTE**: Nenhuma parcela paga
  - **PARCIAL**: Algumas parcelas pagas
  - **QUITADO**: Todas as parcelas pagas
  - **VENCIDO**: Possui parcelas vencidas

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `receivables`
```sql
CREATE TABLE receivables (
  id INT PRIMARY KEY AUTO_INCREMENT,
  saleId INT NOT NULL,
  customerId INT NOT NULL,
  totalAmount DECIMAL(10,2) NOT NULL,
  receivedAmount DECIMAL(10,2) DEFAULT '0.00',
  status ENUM('PENDENTE', 'PARCIAL', 'QUITADO', 'VENCIDO') DEFAULT 'PENDENTE',
  createdBy VARCHAR(255) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (saleId) REFERENCES sales(id),
  FOREIGN KEY (customerId) REFERENCES partners(id)
);
```

### Tabela: `receivableInstallments`
```sql
CREATE TABLE receivableInstallments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  receivableId INT NOT NULL,
  installmentNumber INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  dueDate DATE NOT NULL,
  paidDate DATE,
  paidAmount DECIMAL(10,2),
  paymentMethod VARCHAR(50),
  notes TEXT,
  status ENUM('PENDENTE', 'PAGO', 'PARCIAL', 'VENCIDO') DEFAULT 'PENDENTE',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (receivableId) REFERENCES receivables(id)
);
```

---

## 🔌 API (tRPC)

### Rotas Disponíveis

#### `receivables.list`
Lista recebíveis com filtros opcionais
```typescript
input: {
  customerId?: number;
  status?: "PENDENTE" | "PARCIAL" | "QUITADO" | "VENCIDO";
}
```

#### `receivables.get`
Obtém recebível por ID com parcelas
```typescript
input: { id: number }
```

#### `receivables.summary`
Retorna resumo financeiro
```typescript
output: {
  totalPending: number;
  totalOverdue: number;
  receivedToday: number;
}
```

#### `receivables.installments.pending`
Lista parcelas pendentes
```typescript
input: { customerId?: number }
```

#### `receivables.installments.overdue`
Lista parcelas vencidas

#### `receivables.installments.pay`
Registra pagamento de parcela
```typescript
input: {
  id: number;
  paidDate: Date;
  paidAmount: string;
  paymentMethod: string;
  notes?: string;
}
```

---

## 🎯 Fluxo de Uso

### 1. Criação Automática (via Venda A_PRAZO)
```typescript
// Ao criar venda A_PRAZO, passar dueDates
const sale = await createSale({
  saleType: "A_PRAZO",
  customerId: 1,
  finalAmount: "500.00",
  dueDates: [
    { date: new Date("2025-11-20"), amount: "250.00" },
    { date: new Date("2025-12-20"), amount: "250.00" }
  ],
  items: [...]
});

// Sistema cria automaticamente:
// - 1 recebível vinculado à venda
// - 2 parcelas com valores e vencimentos individuais
```

### 2. Consulta de Parcelas Pendentes
- Acesse: Menu lateral > "Contas a Receber"
- Visualize: Aba "Parcelas Pendentes"
- Informações: Venda, parcela, valor, vencimento, dias restantes

### 3. Registro de Recebimento
- Clique: Botão "Receber" na parcela desejada
- Preencha:
  - Data do recebimento
  - Valor recebido
  - Forma de pagamento
  - Observações (opcional)
- Confirme: Botão "Confirmar Recebimento"

### 4. Atualização Automática
- Dashboard atualizado em tempo real
- Parcela removida da lista de pendentes
- Status do recebível atualizado automaticamente

---

## 📊 Exemplo de Teste

### Criar Venda A_PRAZO com Recebível
```typescript
// 1. Criar venda
const saleId = await createSale({
  saleType: "A_PRAZO",
  customerId: 60001,
  subtotal: "500.00",
  finalAmount: "500.00",
  dueDates: [
    { date: new Date("2025-11-20"), amount: "250.00" },
    { date: new Date("2025-12-20"), amount: "250.00" }
  ],
  items: [{ productId: 1, quantity: 1, unitPrice: "500.00", totalPrice: "500.00" }]
});

// 2. Sistema cria automaticamente:
// - Recebível #1
// - Parcela 1: R$ 250,00 - Vencimento: 20/11/2025
// - Parcela 2: R$ 250,00 - Vencimento: 20/12/2025

// 3. Dashboard mostra:
// - A Receber: R$ 500,00
// - Vencidas: R$ 0,00
// - Recebido Hoje: R$ 0,00
```

### Registrar Recebimento
```typescript
// 1. Pagar parcela 1
await payInstallment({
  id: 1,
  paidDate: new Date(),
  paidAmount: "250.00",
  paymentMethod: "PIX"
});

// 2. Dashboard atualizado:
// - A Receber: R$ 250,00 (reduziu R$ 250,00)
// - Recebido Hoje: R$ 250,00 (aumentou R$ 250,00)
// - Parcelas Pendentes: 1 (era 2)
```

---

## 🔄 Integração com Outros Módulos

### Vendas
- Vendas A_PRAZO criam recebíveis automaticamente
- Parcelas geradas com valores e vencimentos individuais

### Parceiros (Clientes)
- Filtro de parcelas por cliente
- Controle de limite de crédito integrado

### Fluxo de Caixa (Futuro)
- Recebimentos alimentam o fluxo de caixa
- Previsão de entradas baseada em parcelas pendentes

---

## ✅ Testes Realizados

### Teste 1: Criação de Recebível
- ✅ Venda A_PRAZO criada: #150002 - R$ 500,00
- ✅ Recebível criado automaticamente: ID 1
- ✅ 2 parcelas geradas com valores individuais

### Teste 2: Dashboard
- ✅ A Receber: R$ 500,00 (correto)
- ✅ Vencidas: R$ 0,00 (correto)
- ✅ Recebido Hoje: R$ 0,00 (correto)

### Teste 3: Registro de Recebimento
- ✅ Modal aberto com informações corretas
- ✅ Pagamento via PIX registrado
- ✅ Dashboard atualizado automaticamente
- ✅ Parcela removida da lista de pendentes

### Teste 4: Atualização de Status
- ✅ Status do recebível: PENDENTE → PARCIAL
- ✅ Valor recebido: R$ 0,00 → R$ 250,00
- ✅ Total pendente: R$ 500,00 → R$ 250,00

---

## 📈 Estatísticas do Módulo

- **~600 linhas de código** implementadas
- **2 tabelas** no banco de dados
- **6 rotas de API** criadas
- **11 formas de pagamento** suportadas
- **4 status de recebível** (PENDENTE, PARCIAL, QUITADO, VENCIDO)
- **4 status de parcela** (PENDENTE, PAGO, PARCIAL, VENCIDO)

---

## 🚀 Próximos Passos

1. **Módulo de Contas a Pagar** (próximo)
2. **Fluxo de Caixa** (integração completa)
3. **Relatórios de Recebimentos**
4. **Notificações de Vencimento**
5. **Histórico de Recebimentos**

---

## 📝 Notas Técnicas

### Recebimento Parcial
O sistema suporta recebimento parcial de parcelas:
- Se `paidAmount < amount`: status = "PARCIAL"
- Se `paidAmount >= amount`: status = "PAGO"

### Atualização de Status
O status do recebível é atualizado automaticamente após cada recebimento:
1. Busca todas as parcelas do recebível
2. Calcula total recebido
3. Verifica se há parcelas vencidas
4. Atualiza status conforme regras de negócio

### Performance
- Queries otimizadas com joins
- Índices em chaves estrangeiras
- Atualização em lote quando necessário

---

**Data de Implementação:** 21 de Outubro de 2025  
**Status:** ✅ Completo e Testado  
**Versão:** 1.0

