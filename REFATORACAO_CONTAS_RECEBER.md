# Refatoração do Módulo de Contas a Receber

## 🎯 Objetivo

Transformar o módulo de Contas a Receber em uma **gestão de conta corrente por cliente**, focada nas vendas A_PRAZO.

---

## 📋 Nova Estrutura

### 1. Layout Integrado
- ✅ Usar DashboardLayout (menu lateral visível)
- ✅ Remover dashboard isolado
- ✅ Seguir padrão dos outros módulos

### 2. Resumo Geral
```
┌─────────────────────────────────────────┐
│ Total Pendente de Recebimento           │
│ R$ 5.400,00                             │
│ Soma de todas as vendas A_PRAZO         │
└─────────────────────────────────────────┘
```

### 3. Lista de Clientes com Saldo Devedor
```
┌─────────────────────────────────────────┐
│ Clientes com Saldo Devedor              │
├─────────────────────────────────────────┤
│ > Gabriel Morais         R$ 2.500,00    │ ← Clicável
│ > João Silva             R$ 1.900,00    │ ← Clicável
│ > Maria Santos           R$ 1.000,00    │ ← Clicável
└─────────────────────────────────────────┘
```

### 4. Detalhamento do Cliente (Modal/Drawer)
Ao clicar em um cliente, abrir detalhamento com:

#### A. Informações do Cliente
- Nome
- Limite de crédito
- Saldo devedor atual

#### B. Histórico de Vendas A_PRAZO
Tabela com todas as vendas A_PRAZO do cliente:

| Data       | Venda # | Produtos                    | Qtd | Total    | Pago     | Saldo   |
|------------|---------|----------------------------|-----|----------|----------|---------|
| 20/10/2025 | #150002 | Coca Cola 2l               | 1   | R$ 500,00| R$ 250,00| R$ 250,00|
| 15/10/2025 | #150001 | Cerveja Heineken, Vodka... | 3   | R$ 800,00| R$ 0,00  | R$ 800,00|

**Subtotal:** R$ 1.050,00

#### C. Registro de Recebimentos
Formulário para registrar recebimento:
- **Data do Recebimento:** [campo de data]
- **Valor Recebido:** [campo numérico]
- **Forma de Pagamento:** [select com 11 opções]
- **Aplicar em:** [select com vendas pendentes]
- **Observações:** [textarea]
- **Botão:** "Registrar Recebimento"

#### D. Acréscimo de Valores (Opcional)
Formulário para adicionar juros, multas, etc:
- **Descrição:** [ex: "Juros de atraso"]
- **Valor:** [campo numérico]
- **Data:** [campo de data]
- **Botão:** "Adicionar Valor"

---

## 🗄️ Ajustes no Backend

### Nova Rota: `receivables.byCustomer`
Retorna lista de clientes com saldo devedor:
```typescript
output: [
  {
    customerId: number;
    customerName: string;
    totalPending: string; // Saldo devedor total
    salesCount: number; // Quantidade de vendas pendentes
  }
]
```

### Nova Rota: `receivables.customerDetail`
Retorna detalhamento completo de um cliente:
```typescript
input: { customerId: number }
output: {
  customer: {
    id: number;
    name: string;
    creditLimit: string;
    currentBalance: string;
  };
  sales: [
    {
      id: number;
      saleDate: Date;
      finalAmount: string;
      paidAmount: string;
      pendingAmount: string;
      items: [...];
      installments: [...];
    }
  ];
  totalPending: string;
}
```

### Ajustar Rota: `receivables.installments.pay`
Permitir especificar a venda ao registrar recebimento:
```typescript
input: {
  customerId: number;
  saleId?: number; // Opcional: aplicar em venda específica
  paidDate: Date;
  paidAmount: string;
  paymentMethod: string;
  notes?: string;
}
```

---

## 🎨 Interface Frontend

### Componente Principal: `ContasReceber.tsx`
```tsx
<div className="space-y-6">
  {/* Header */}
  <div>
    <h1>Contas a Receber</h1>
    <p>Gestão de recebimentos das vendas a prazo</p>
  </div>

  {/* Card de Resumo */}
  <Card>
    <CardHeader>
      <CardTitle>Total Pendente de Recebimento</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold">R$ 5.400,00</div>
      <p className="text-sm text-muted-foreground">
        Soma de todas as vendas A_PRAZO pendentes
      </p>
    </CardContent>
  </Card>

  {/* Lista de Clientes */}
  <Card>
    <CardHeader>
      <CardTitle>Clientes com Saldo Devedor</CardTitle>
    </CardHeader>
    <CardContent>
      {customers.map(customer => (
        <div 
          key={customer.id}
          onClick={() => openCustomerDetail(customer.id)}
          className="flex justify-between p-4 border rounded cursor-pointer hover:bg-accent"
        >
          <span className="font-medium">{customer.name}</span>
          <span className="text-lg font-bold">
            {formatCurrency(customer.totalPending)}
          </span>
        </div>
      ))}
    </CardContent>
  </Card>
</div>
```

### Modal de Detalhamento: `CustomerDetailModal.tsx`
```tsx
<Dialog>
  <DialogContent className="max-w-4xl">
    {/* Informações do Cliente */}
    <div className="grid grid-cols-3 gap-4">
      <div>
        <Label>Cliente</Label>
        <p className="font-bold">{customer.name}</p>
      </div>
      <div>
        <Label>Limite de Crédito</Label>
        <p>{formatCurrency(customer.creditLimit)}</p>
      </div>
      <div>
        <Label>Saldo Devedor</Label>
        <p className="text-red-600 font-bold">
          {formatCurrency(customer.currentBalance)}
        </p>
      </div>
    </div>

    {/* Tabela de Vendas */}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Venda #</TableHead>
          <TableHead>Produtos</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Pago</TableHead>
          <TableHead>Saldo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sales.map(sale => (
          <TableRow key={sale.id}>
            <TableCell>{formatDate(sale.saleDate)}</TableCell>
            <TableCell>#{sale.id}</TableCell>
            <TableCell>{sale.items.map(i => i.productName).join(', ')}</TableCell>
            <TableCell>{formatCurrency(sale.finalAmount)}</TableCell>
            <TableCell>{formatCurrency(sale.paidAmount)}</TableCell>
            <TableCell className="font-bold">
              {formatCurrency(sale.pendingAmount)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>

    {/* Formulário de Recebimento */}
    <div className="border-t pt-4">
      <h3 className="font-bold mb-4">Registrar Recebimento</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Data do Recebimento</Label>
          <Input type="date" />
        </div>
        <div>
          <Label>Valor Recebido</Label>
          <Input type="number" step="0.01" />
        </div>
        <div>
          <Label>Forma de Pagamento</Label>
          <Select>...</Select>
        </div>
        <div>
          <Label>Aplicar em</Label>
          <Select>
            <SelectItem value="oldest">Venda mais antiga</SelectItem>
            <SelectItem value="150002">Venda #150002</SelectItem>
            <SelectItem value="150001">Venda #150001</SelectItem>
          </Select>
        </div>
      </div>
      <div className="mt-4">
        <Label>Observações</Label>
        <Textarea />
      </div>
      <Button className="mt-4">Registrar Recebimento</Button>
    </div>
  </DialogContent>
</Dialog>
```

---

## 🔄 Fluxo de Uso

### 1. Visualizar Resumo
- Acessa: Menu lateral > "Contas a Receber"
- Visualiza: Total pendente de recebimento
- Lista: Todos os clientes com saldo devedor

### 2. Abrir Detalhamento do Cliente
- Clica: No nome do cliente na lista
- Abre: Modal/Drawer com histórico completo
- Visualiza: Todas as vendas A_PRAZO e saldos

### 3. Registrar Recebimento
- Preenche: Data, valor, forma de pagamento
- Seleciona: Venda específica ou "mais antiga"
- Confirma: Recebimento é registrado
- Atualiza: Saldo devedor do cliente automaticamente

### 4. Acrescer Valor (Opcional)
- Adiciona: Juros, multas, taxas
- Descrição: Motivo do acréscimo
- Atualiza: Saldo devedor aumenta

---

## ✅ Checklist de Implementação

### Backend
- [ ] Criar rota `receivables.byCustomer`
- [ ] Criar rota `receivables.customerDetail`
- [ ] Ajustar rota `receivables.installments.pay`
- [ ] Adicionar função para acrescer valores

### Frontend
- [ ] Reescrever `ContasReceber.tsx` com novo layout
- [ ] Criar componente `CustomerDetailModal.tsx`
- [ ] Implementar lista de clientes clicável
- [ ] Implementar formulário de recebimento
- [ ] Implementar formulário de acréscimo (opcional)

### Testes
- [ ] Testar listagem de clientes
- [ ] Testar abertura de detalhamento
- [ ] Testar registro de recebimento
- [ ] Testar atualização de saldo devedor
- [ ] Testar acréscimo de valores

---

## 📊 Exemplo Visual

```
┌────────────────────────────────────────────────────────────┐
│ Contas a Receber                                           │
│ Gestão de recebimentos das vendas a prazo                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Total Pendente de Recebimento                      │   │
│ │ R$ 5.400,00                                        │   │
│ │ Soma de todas as vendas A_PRAZO pendentes          │   │
│ └────────────────────────────────────────────────────┘   │
│                                                            │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Clientes com Saldo Devedor                         │   │
│ ├────────────────────────────────────────────────────┤   │
│ │ > Gabriel Morais              R$ 2.500,00 [>]     │   │
│ │ > João Silva                  R$ 1.900,00 [>]     │   │
│ │ > Maria Santos                R$ 1.000,00 [>]     │   │
│ └────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘

[Ao clicar em um cliente]

┌────────────────────────────────────────────────────────────┐
│ Conta Corrente - Gabriel Morais                      [X]   │
├────────────────────────────────────────────────────────────┤
│ Limite: R$ 5.000,00 | Saldo Devedor: R$ 2.500,00          │
├────────────────────────────────────────────────────────────┤
│ Vendas A Prazo:                                            │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ Data   | Venda | Produtos    | Total | Pago | Saldo │  │
│ ├──────────────────────────────────────────────────────┤  │
│ │ 20/10  | #150  | Coca Cola   | 500   | 250  | 250   │  │
│ │ 15/10  | #149  | Heineken... | 800   | 0    | 800   │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                            │
│ Registrar Recebimento:                                     │
│ Data: [21/10/2025] Valor: [500.00]                        │
│ Forma: [PIX ▼] Aplicar em: [Venda mais antiga ▼]         │
│ Obs: [____________________________________]                │
│ [Registrar Recebimento]                                    │
└────────────────────────────────────────────────────────────┘
```

---

**Status:** 📝 Planejamento Completo  
**Próximo Passo:** Implementar backend

