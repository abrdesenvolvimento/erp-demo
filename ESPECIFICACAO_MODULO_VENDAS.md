# Especificação Completa - Módulo de Vendas

**Data:** 20 de Outubro de 2025  
**Sistema:** ERP Adega Beira Rio - Demo  
**Status:** 📋 **PLANEJAMENTO**

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Tipos de Venda](#tipos-de-venda)
3. [Estrutura do Banco de Dados](#estrutura-do-banco-de-dados)
4. [Funcionalidades Principais](#funcionalidades-principais)
5. [Interface do Usuário](#interface-do-usuário)
6. [Regras de Negócio](#regras-de-negócio)
7. [Integrações](#integrações)
8. [Validações](#validações)
9. [Fluxos de Trabalho](#fluxos-de-trabalho)
10. [Casos de Uso](#casos-de-uso)
11. [Requisitos Técnicos](#requisitos-técnicos)

---

## 🎯 Visão Geral

O módulo de Vendas é responsável por registrar e gerenciar todas as vendas realizadas pela Adega Beira Rio, incluindo:

- **Vendas de Balcão** (venda direta no estabelecimento)
- **Vendas por Delivery** (pedidos de entrega via plataformas)
- **Vendas a Prazo** (vendas com pagamento futuro para clientes cadastrados)

### Objetivos Principais

1. ✅ Registrar vendas de forma rápida e eficiente
2. ✅ Controlar estoque automaticamente após cada venda
3. ✅ Gerenciar limite de crédito de clientes
4. ✅ Aplicar preços corretos por canal de venda
5. ✅ Calcular descontos e acréscimos
6. ✅ Gerar relatórios de vendas
7. ✅ Integrar com plataformas de delivery

---

## 📦 Tipos de Venda

### 1. Venda de Balcão (BALCAO)

**Características:**
- Venda presencial no estabelecimento
- Pagamento à vista (dinheiro, cartão, PIX)
- Não requer cliente cadastrado (opcional)
- Preço utiliza o canal de venda selecionado
- Baixa imediata no estoque

**Campos Obrigatórios:**
- Canal de venda
- Itens (produtos + quantidades)
- Forma de pagamento
- Valor total

**Campos Opcionais:**
- Cliente (se cadastrado)
- Desconto
- Acréscimo
- Observações

### 2. Venda por Delivery (DELIVERY)

**Características:**
- Pedido via plataforma (iFood, Rappi, etc.)
- Requer ID do pedido na plataforma
- Requer canal de venda (plataforma específica)
- Preço específico do canal de delivery
- Baixa imediata no estoque
- Pode ter taxa de entrega (acréscimo)

**Campos Obrigatórios:**
- Canal de venda (delivery)
- ID do pedido na plataforma
- Itens (produtos + quantidades)
- Valor total
- Forma de pagamento

**Campos Opcionais:**
- Cliente (se identificado)
- Taxa de entrega (acréscimo)
- Desconto
- Observações

### 3. Venda a Prazo (A_PRAZO)

**Características:**
- Venda com pagamento futuro
- **REQUER cliente cadastrado**
- Verifica limite de crédito do cliente
- Atualiza saldo devedor do cliente
- Pode requerer aprovação de administrador
- Baixa imediata no estoque
- Gera conta a receber

**Campos Obrigatórios:**
- Cliente (obrigatório)
- Canal de venda
- Itens (produtos + quantidades)
- Valor total
- Data de vencimento (futura implementação)

**Campos Opcionais:**
- Desconto
- Acréscimo
- Observações
- Aprovação de administrador

**Validações Especiais:**
- ✅ Cliente deve estar ativo
- ✅ Cliente deve ter política de crédito "ATIVA"
- ✅ Saldo devedor + valor da venda ≤ Limite de crédito
- ✅ Se exceder limite, requer aprovação de administrador

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `sales` (Vendas)

```sql
CREATE TABLE sales (
  id INT PRIMARY KEY AUTO_INCREMENT,
  saleType ENUM('BALCAO', 'DELIVERY', 'A_PRAZO') NOT NULL,
  saleDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  customerId INT,                          -- FK para partners (opcional para BALCAO/DELIVERY)
  channelId INT,                           -- FK para salesChannels
  platformOrderId VARCHAR(100),            -- ID do pedido na plataforma (delivery)
  subtotal DECIMAL(10,2) NOT NULL,         -- Soma dos itens
  discountAmount DECIMAL(10,2) DEFAULT 0,  -- Desconto aplicado
  surchargeAmount DECIMAL(10,2) DEFAULT 0, -- Acréscimo (taxa de entrega, etc)
  finalAmount DECIMAL(10,2) NOT NULL,      -- Valor final = subtotal - desconto + acréscimo
  paymentMethod VARCHAR(50),               -- Forma de pagamento
  requiresAdminApproval BOOLEAN DEFAULT FALSE,
  adminApprovedBy VARCHAR(64),             -- FK para users (quem aprovou)
  notes TEXT,                              -- Observações
  createdBy VARCHAR(64) NOT NULL,          -- FK para users (quem registrou)
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX date_idx (saleDate),
  INDEX customer_idx (customerId)
);
```

### Tabela: `saleItems` (Itens de Venda)

```sql
CREATE TABLE saleItems (
  id INT PRIMARY KEY AUTO_INCREMENT,
  saleId INT NOT NULL,                     -- FK para sales
  productId INT NOT NULL,                  -- FK para products
  quantity INT NOT NULL,                   -- Quantidade vendida
  unitPrice DECIMAL(10,2) NOT NULL,        -- Preço unitário no momento da venda
  totalPrice DECIMAL(10,2) NOT NULL,       -- Preço total = quantity * unitPrice
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (saleId) REFERENCES sales(id),
  FOREIGN KEY (productId) REFERENCES products(id)
);
```

### Relacionamentos

```
sales
├── customerId → partners.id (opcional)
├── channelId → salesChannels.id
├── createdBy → users.id
└── adminApprovedBy → users.id (opcional)

saleItems
├── saleId → sales.id
└── productId → products.id
```

---

## ⚙️ Funcionalidades Principais

### 1. Listagem de Vendas

**Características:**
- ✅ Tabela com todas as vendas
- ✅ Filtros: tipo de venda, cliente, canal, período
- ✅ Busca por ID, cliente, plataforma
- ✅ Ordenação por data (mais recente primeiro)
- ✅ Paginação (50 registros por página)
- ✅ Badges coloridos para tipo de venda
- ✅ Indicador visual de vendas pendentes de aprovação

**Colunas da Tabela:**
- ID da Venda
- Data/Hora
- Tipo (Badge colorido)
- Cliente (nome ou "Venda Avulsa")
- Canal
- Valor Total
- Forma de Pagamento
- Status (Aprovada/Pendente)
- Ações (Ver detalhes, Aprovar se admin)

### 2. Cadastro de Nova Venda

**Fluxo:**

1. **Seleção do Tipo de Venda**
   - Botões grandes: "Balcão", "Delivery", "A Prazo"
   - Cada tipo abre formulário específico

2. **Seleção do Canal de Venda**
   - Dropdown com canais ativos
   - Filtra por tipo (BALCAO ou DELIVERY)
   - Define qual tabela de preços usar

3. **Seleção do Cliente** (opcional para BALCAO/DELIVERY, obrigatório para A_PRAZO)
   - Autocomplete com busca
   - Mostra: nome, documento, limite de crédito, saldo devedor
   - Para A_PRAZO: valida crédito disponível

4. **Adição de Produtos**
   - Busca de produtos por nome ou EAN
   - Autocomplete com produtos ativos
   - Mostra: nome, estoque atual, preço do canal
   - Adiciona à lista de itens
   - Permite editar quantidade
   - Permite remover item
   - Valida estoque disponível

5. **Resumo da Venda**
   - Lista de itens com quantidades e valores
   - Subtotal
   - Campo para desconto (% ou R$)
   - Campo para acréscimo (% ou R$)
   - **Valor Final** (destaque)

6. **Forma de Pagamento**
   - Dropdown: Dinheiro, Cartão Débito, Cartão Crédito, PIX, A Prazo
   - Para delivery: pode incluir "Pago na Plataforma"

7. **Observações** (opcional)
   - Campo de texto livre

8. **Confirmação**
   - Botão "Finalizar Venda"
   - Mostra resumo antes de confirmar
   - Processa venda:
     - Salva venda no banco
     - Salva itens da venda
     - **Baixa estoque de cada produto**
     - Se A_PRAZO: atualiza saldo devedor do cliente
     - Se requer aprovação: marca como pendente

### 3. Visualização de Detalhes da Venda

**Informações Exibidas:**
- Cabeçalho da venda (ID, data, tipo, status)
- Cliente (se houver)
- Canal de venda
- Forma de pagamento
- Tabela de itens vendidos
- Cálculos (subtotal, desconto, acréscimo, total)
- Observações
- Informações de auditoria (criado por, data)
- Se pendente: botão "Aprovar" (apenas admin)

### 4. Aprovação de Vendas (Admin)

**Quando Necessário:**
- Vendas a prazo que excedem limite de crédito
- Vendas com desconto acima de X%
- Vendas com valor acima de R$ Y

**Fluxo:**
1. Admin visualiza vendas pendentes
2. Revisa detalhes da venda
3. Aprova ou rejeita
4. Se aprovar: venda é efetivada
5. Se rejeitar: venda é cancelada, estoque é restaurado

### 5. Cancelamento de Vendas (Futura Implementação)

**Regras:**
- Apenas admin pode cancelar
- Apenas vendas do dia podem ser canceladas
- Restaura estoque dos produtos
- Se A_PRAZO: restaura saldo devedor do cliente
- Registra motivo do cancelamento

---

## 🎨 Interface do Usuário

### Página Principal de Vendas

```
┌─────────────────────────────────────────────────────────────┐
│  🛒 Vendas                                  [+ Nova Venda]   │
│  Registre e gerencie vendas do sistema                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Buscar vendas...]                                         │
│                                                              │
│  Filtros:                                                   │
│  [Tipo ▼] [Cliente ▼] [Canal ▼] [Período ▼]  [Filtrar]    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ID  │ Data/Hora      │ Tipo     │ Cliente  │ Total  │  │
│  ├─────┼────────────────┼──────────┼──────────┼────────┤  │
│  │ 123 │ 20/10 14:30   │ BALCÃO   │ João     │ R$ 150 │  │
│  │ 122 │ 20/10 14:15   │ DELIVERY │ Maria    │ R$ 280 │  │
│  │ 121 │ 20/10 13:45   │ A PRAZO  │ Pedro    │ R$ 500 │  │
│  └─────┴────────────────┴──────────┴──────────┴────────┘  │
│                                                              │
│  Mostrando 1-50 de 234 vendas          [1] [2] [3] ... [5] │
└─────────────────────────────────────────────────────────────┘
```

### Modal de Nova Venda - Passo 1: Tipo

```
┌─────────────────────────────────────────────────────────────┐
│  Nova Venda                                         [X]      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Selecione o tipo de venda:                                 │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   🏪         │  │   🛵         │  │   📅         │     │
│  │   BALCÃO     │  │   DELIVERY   │  │   A PRAZO    │     │
│  │              │  │              │  │              │     │
│  │ Venda direta │  │ Pedido de    │  │ Pagamento    │     │
│  │ no balcão    │  │ entrega      │  │ futuro       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Modal de Nova Venda - Passo 2: Formulário

```
┌─────────────────────────────────────────────────────────────┐
│  Nova Venda - BALCÃO                                [X]      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Canal de Venda *                                           │
│  [Selecione o canal ▼]                                      │
│                                                              │
│  Cliente (opcional)                                         │
│  [Buscar cliente...]                                        │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Produtos                                               │ │
│  │                                                        │ │
│  │ [Buscar produto por nome ou EAN...]         [Buscar] │ │
│  │                                                        │ │
│  │ ┌────────────────────────────────────────────────┐   │ │
│  │ │ Produto        │ Qtd │ Preço Un. │ Total      │   │ │
│  │ ├────────────────┼─────┼───────────┼────────────┤   │ │
│  │ │ Cerveja Skol   │  2  │ R$ 3,50   │ R$ 7,00  [X]│   │ │
│  │ │ Coca-Cola 2L   │  1  │ R$ 8,00   │ R$ 8,00  [X]│   │ │
│  │ └────────────────┴─────┴───────────┴────────────┘   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Resumo                                                 │ │
│  │                                                        │ │
│  │ Subtotal:                              R$ 15,00       │ │
│  │ Desconto:  [R$ 0,00]                  -R$ 0,00       │ │
│  │ Acréscimo: [R$ 0,00]                  +R$ 0,00       │ │
│  │                                                        │ │
│  │ TOTAL:                                 R$ 15,00       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Forma de Pagamento *                                       │
│  [Selecione ▼]                                              │
│                                                              │
│  Observações                                                │
│  [Digite observações...]                                    │
│                                                              │
│                          [Cancelar]  [Finalizar Venda]      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📏 Regras de Negócio

### 1. Controle de Estoque

**Regra:** Toda venda deve dar baixa automática no estoque.

**Implementação:**
```typescript
// Ao finalizar venda
for (const item of saleItems) {
  await updateProductStock(item.productId, -item.quantity);
}
```

**Validação:**
- ✅ Não permitir vender quantidade maior que estoque disponível
- ✅ Alertar quando estoque ficar abaixo do mínimo
- ✅ Produtos inativos não podem ser vendidos

### 2. Preços por Canal

**Regra:** O preço do produto deve ser buscado de acordo com o canal de venda selecionado.

**Implementação:**
```typescript
const price = await getProductPrice(productId, channelId);
```

**Validação:**
- ✅ Se produto não tem preço no canal, não pode ser vendido
- ✅ Preço é fixado no momento da venda (não muda se alterar depois)

### 3. Limite de Crédito (Vendas a Prazo)

**Regra:** Cliente não pode comprar a prazo se exceder o limite de crédito.

**Cálculo:**
```typescript
const availableCredit = customer.creditLimit - customer.currentBalance;
const canSell = saleAmount <= availableCredit;
```

**Validações:**
- ✅ Cliente deve estar ativo
- ✅ Política de crédito deve estar "ATIVA"
- ✅ Saldo devedor + valor da venda ≤ Limite de crédito
- ✅ Se exceder, marcar venda como "Requer Aprovação Admin"

**Atualização do Saldo:**
```typescript
// Ao finalizar venda a prazo
customer.currentBalance += saleAmount;
await updatePartner(customerId, { currentBalance });
```

### 4. Descontos e Acréscimos

**Descontos:**
- Podem ser em % ou R$
- Desconto máximo: 20% (configurável)
- Descontos acima do máximo requerem aprovação de admin

**Acréscimos:**
- Geralmente usado para taxa de entrega em delivery
- Podem ser em % ou R$
- Sem limite máximo

**Cálculo:**
```typescript
const subtotal = saleItems.reduce((sum, item) => sum + item.totalPrice, 0);
const discountValue = isPercentage 
  ? subtotal * (discount / 100) 
  : discount;
const surchargeValue = isPercentage 
  ? subtotal * (surcharge / 100) 
  : surcharge;
const finalAmount = subtotal - discountValue + surchargeValue;
```

### 5. Formas de Pagamento

**Opções:**
- Dinheiro
- Cartão de Débito
- Cartão de Crédito
- PIX
- A Prazo (apenas para vendas A_PRAZO)
- Pago na Plataforma (apenas para DELIVERY)

**Validações:**
- ✅ Forma de pagamento é obrigatória
- ✅ "A Prazo" só pode ser usado em vendas tipo A_PRAZO
- ✅ "Pago na Plataforma" só pode ser usado em vendas tipo DELIVERY

---

## 🔗 Integrações

### 1. Módulo de Produtos

**Dependências:**
- ✅ Buscar produtos ativos
- ✅ Verificar estoque disponível
- ✅ Buscar preço por canal
- ✅ Atualizar estoque após venda

**Endpoints Utilizados:**
```typescript
products.list({ activeOnly: true, search })
products.get({ id })
productPrices.getByChannel({ productId, channelId })
products.updateStock({ id, quantity })
```

### 2. Módulo de Parceiros

**Dependências:**
- ✅ Buscar clientes ativos
- ✅ Verificar limite de crédito
- ✅ Atualizar saldo devedor
- ✅ Verificar política de crédito

**Endpoints Utilizados:**
```typescript
partners.list({ partnerType: 'CUSTOMER', activeOnly: true, search })
partners.get({ id })
partners.update({ id, currentBalance })
```

### 3. Canais de Venda

**Dependências:**
- ✅ Listar canais ativos
- ✅ Filtrar por tipo (BALCAO ou DELIVERY)

**Endpoints Utilizados:**
```typescript
salesChannels.list({ activeOnly: true })
```

### 4. Usuários (Autenticação)

**Dependências:**
- ✅ Identificar usuário logado (createdBy)
- ✅ Verificar se é admin (para aprovações)

**Contexto:**
```typescript
ctx.user.id
ctx.user.role === 'admin'
```

---

## ✅ Validações

### Validações de Frontend (React Hook Form + Zod)

```typescript
const saleSchema = z.object({
  saleType: z.enum(['BALCAO', 'DELIVERY', 'A_PRAZO']),
  channelId: z.number().min(1, 'Canal é obrigatório'),
  customerId: z.number().optional(),
  platformOrderId: z.string().optional(),
  items: z.array(z.object({
    productId: z.number(),
    quantity: z.number().min(1, 'Quantidade deve ser maior que 0'),
    unitPrice: z.string(),
    totalPrice: z.string(),
  })).min(1, 'Adicione pelo menos um produto'),
  discountAmount: z.string().optional(),
  surchargeAmount: z.string().optional(),
  paymentMethod: z.string().min(1, 'Forma de pagamento é obrigatória'),
  notes: z.string().optional(),
});
```

### Validações de Backend (tRPC)

```typescript
// Validar estoque
for (const item of items) {
  const product = await db.getProduct(item.productId);
  if (product.currentStock < item.quantity) {
    throw new Error(`Estoque insuficiente para ${product.name}`);
  }
}

// Validar cliente (A_PRAZO)
if (saleType === 'A_PRAZO') {
  if (!customerId) {
    throw new Error('Cliente é obrigatório para vendas a prazo');
  }
  
  const customer = await db.getPartner(customerId);
  if (!customer.active) {
    throw new Error('Cliente inativo');
  }
  
  if (customer.creditPolicy !== 'ACTIVE') {
    throw new Error('Cliente com crédito bloqueado');
  }
  
  const availableCredit = parseFloat(customer.creditLimit) - parseFloat(customer.currentBalance);
  if (parseFloat(finalAmount) > availableCredit) {
    // Marcar como requer aprovação
    requiresAdminApproval = true;
  }
}
```

---

## 🔄 Fluxos de Trabalho

### Fluxo 1: Venda de Balcão Simples

```
1. Usuário clica em "Nova Venda"
2. Seleciona "BALCÃO"
3. Seleciona canal de venda (ex: "Balcão Principal")
4. Busca e adiciona produtos:
   - Cerveja Skol 350ml (2 unidades)
   - Coca-Cola 2L (1 unidade)
5. Sistema calcula subtotal: R$ 15,00
6. Usuário não aplica desconto/acréscimo
7. Seleciona forma de pagamento: "Dinheiro"
8. Clica em "Finalizar Venda"
9. Sistema:
   - Salva venda no banco
   - Salva itens da venda
   - Baixa 2 unidades de Cerveja Skol do estoque
   - Baixa 1 unidade de Coca-Cola 2L do estoque
10. Mostra mensagem de sucesso
11. Retorna para listagem de vendas
```

### Fluxo 2: Venda por Delivery

```
1. Usuário clica em "Nova Venda"
2. Seleciona "DELIVERY"
3. Seleciona canal de venda (ex: "iFood")
4. Informa ID do pedido na plataforma: "ABC123"
5. Busca e adiciona produtos (preços do canal iFood)
6. Sistema calcula subtotal: R$ 50,00
7. Usuário adiciona acréscimo de taxa de entrega: R$ 5,00
8. Total: R$ 55,00
9. Seleciona forma de pagamento: "Pago na Plataforma"
10. Clica em "Finalizar Venda"
11. Sistema processa venda e baixa estoque
12. Sucesso
```

### Fluxo 3: Venda a Prazo com Aprovação

```
1. Usuário clica em "Nova Venda"
2. Seleciona "A PRAZO"
3. Seleciona canal de venda
4. Busca e seleciona cliente: "João Silva"
   - Limite de crédito: R$ 5.000,00
   - Saldo devedor atual: R$ 4.800,00
   - Crédito disponível: R$ 200,00
5. Adiciona produtos totalizando R$ 500,00
6. Sistema detecta que excede crédito disponível
7. Marca venda como "Requer Aprovação Admin"
8. Usuário finaliza venda
9. Venda fica com status "Pendente de Aprovação"
10. Admin recebe notificação
11. Admin revisa e aprova a venda
12. Sistema processa venda:
    - Baixa estoque
    - Atualiza saldo devedor: R$ 4.800 + R$ 500 = R$ 5.300,00
13. Sucesso
```

---

## 📚 Casos de Uso

### Caso de Uso 1: Cliente Compra no Balcão

**Ator:** Atendente  
**Pré-condições:** 
- Produtos cadastrados e com estoque
- Canal de balcão configurado

**Fluxo Principal:**
1. Atendente inicia nova venda de balcão
2. Seleciona canal "Balcão Principal"
3. Cliente pede 2 cervejas e 1 refrigerante
4. Atendente busca e adiciona produtos
5. Sistema mostra total: R$ 15,00
6. Cliente paga em dinheiro
7. Atendente finaliza venda
8. Sistema baixa estoque automaticamente

**Pós-condições:**
- Venda registrada
- Estoque atualizado
- Venda aparece na listagem

### Caso de Uso 2: Pedido de Delivery via iFood

**Ator:** Atendente  
**Pré-condições:**
- Canal iFood configurado
- Produtos com preços no canal iFood

**Fluxo Principal:**
1. Chega pedido no iFood
2. Atendente abre ERP e cria nova venda delivery
3. Seleciona canal "iFood"
4. Informa ID do pedido: "ABC123"
5. Adiciona produtos do pedido
6. Adiciona taxa de entrega: R$ 5,00
7. Marca como "Pago na Plataforma"
8. Finaliza venda
9. Sistema baixa estoque

**Pós-condições:**
- Venda registrada com ID da plataforma
- Estoque atualizado
- Possível rastreamento do pedido

### Caso de Uso 3: Cliente Compra a Prazo

**Ator:** Atendente  
**Pré-condições:**
- Cliente cadastrado com limite de crédito
- Política de crédito ativa

**Fluxo Principal:**
1. Atendente inicia venda a prazo
2. Busca e seleciona cliente "Maria Santos"
3. Sistema mostra crédito disponível: R$ 10.000,00
4. Adiciona produtos: R$ 500,00
5. Sistema valida: R$ 500 < R$ 10.000 ✅
6. Atendente finaliza venda
7. Sistema:
   - Baixa estoque
   - Atualiza saldo devedor: R$ 0 + R$ 500 = R$ 500

**Fluxo Alternativo (Excede Limite):**
4a. Adiciona produtos: R$ 11.000,00
5a. Sistema detecta: R$ 11.000 > R$ 10.000 ❌
6a. Sistema marca como "Requer Aprovação"
7a. Atendente finaliza, venda fica pendente
8a. Admin aprova posteriormente

---

## 🛠️ Requisitos Técnicos

### Frontend

**Tecnologias:**
- React + TypeScript
- React Hook Form + Zod (validação)
- tRPC (comunicação com backend)
- shadcn/ui (componentes)
- Lucide React (ícones)
- Sonner (toasts)

**Componentes Necessários:**
- `SalesList` - Listagem de vendas
- `NewSaleModal` - Modal de nova venda
- `SaleTypeSelector` - Seletor de tipo de venda
- `ProductSearch` - Busca de produtos com autocomplete
- `SaleItemsList` - Lista de itens da venda
- `SaleSummary` - Resumo com cálculos
- `SaleDetails` - Visualização de detalhes
- `SaleApproval` - Aprovação de vendas (admin)

**Estados Gerenciados:**
```typescript
const [sales, setSales] = useState<Sale[]>([]);
const [isModalOpen, setIsModalOpen] = useState(false);
const [saleType, setSaleType] = useState<'BALCAO' | 'DELIVERY' | 'A_PRAZO'>();
const [selectedChannel, setSelectedChannel] = useState<number>();
const [selectedCustomer, setSelectedCustomer] = useState<Partner>();
const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
const [discount, setDiscount] = useState('0.00');
const [surcharge, setSurcharge] = useState('0.00');
const [paymentMethod, setPaymentMethod] = useState('');
```

### Backend

**Rotas tRPC:**

```typescript
sales: router({
  // Listar vendas
  list: protectedProcedure
    .input(z.object({
      saleType: z.enum(['BALCAO', 'DELIVERY', 'A_PRAZO']).optional(),
      customerId: z.number().optional(),
      channelId: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ input }) => {
      return await db.getSales(input);
    }),
  
  // Buscar venda por ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const sale = await db.getSale(input.id);
      const items = await db.getSaleItems(input.id);
      return { ...sale, items };
    }),
  
  // Criar venda
  create: protectedProcedure
    .input(z.object({
      saleType: z.enum(['BALCAO', 'DELIVERY', 'A_PRAZO']),
      channelId: z.number(),
      customerId: z.number().optional(),
      platformOrderId: z.string().optional(),
      subtotal: z.string(),
      discountAmount: z.string().default('0.00'),
      surchargeAmount: z.string().default('0.00'),
      finalAmount: z.string(),
      paymentMethod: z.string(),
      notes: z.string().optional(),
      items: z.array(z.object({
        productId: z.number(),
        quantity: z.number(),
        unitPrice: z.string(),
        totalPrice: z.string(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      // Validações
      // Criar venda
      // Criar itens
      // Baixar estoque
      // Atualizar saldo cliente (se A_PRAZO)
      return { id, success: true };
    }),
  
  // Aprovar venda (admin)
  approve: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new Error('Apenas administradores podem aprovar vendas');
      }
      await db.approveSale(input.id, ctx.user.id);
      return { success: true };
    }),
});
```

**Funções do Banco de Dados:**

```typescript
// db/index.ts

export async function getSales(filters?: SalesFilters) {
  // SELECT com JOINs e filtros
}

export async function getSale(id: number) {
  // SELECT venda específica
}

export async function getSaleItems(saleId: number) {
  // SELECT itens da venda
}

export async function createSale(saleData: InsertSale, items: InsertSaleItem[]) {
  // Transaction:
  // 1. INSERT venda
  // 2. INSERT itens
  // 3. UPDATE estoque de cada produto
  // 4. UPDATE saldo cliente (se A_PRAZO)
}

export async function approveSale(saleId: number, adminId: string) {
  // UPDATE venda: requiresAdminApproval = false, adminApprovedBy = adminId
}
```

---

## 📊 Métricas e Relatórios (Futura Implementação)

### Métricas do Dashboard

- Total de vendas do dia/mês
- Ticket médio
- Produtos mais vendidos
- Vendas por canal
- Vendas por tipo
- Vendas pendentes de aprovação

### Relatórios

- Relatório de vendas por período
- Relatório de vendas por cliente
- Relatório de vendas por produto
- Relatório de vendas por canal
- Relatório de comissões (futura implementação)

---

## 🚀 Plano de Implementação

### Fase 1: Estrutura Básica (Prioridade Alta)

1. ✅ Schema do banco já existe
2. ✅ Rotas tRPC básicas já existem
3. ⏳ Criar página de listagem de vendas
4. ⏳ Criar modal de nova venda
5. ⏳ Implementar seletor de tipo de venda

### Fase 2: Venda de Balcão (Prioridade Alta)

1. ⏳ Implementar formulário de venda de balcão
2. ⏳ Implementar busca de produtos
3. ⏳ Implementar adição de itens
4. ⏳ Implementar cálculos (subtotal, desconto, acréscimo, total)
5. ⏳ Implementar finalização de venda
6. ⏳ Implementar baixa de estoque

### Fase 3: Venda por Delivery (Prioridade Média)

1. ⏳ Adaptar formulário para delivery
2. ⏳ Adicionar campo de ID da plataforma
3. ⏳ Implementar seleção de canal de delivery
4. ⏳ Implementar campo de taxa de entrega

### Fase 4: Venda a Prazo (Prioridade Média)

1. ⏳ Implementar seleção obrigatória de cliente
2. ⏳ Implementar validação de limite de crédito
3. ⏳ Implementar atualização de saldo devedor
4. ⏳ Implementar marcação de "Requer Aprovação"

### Fase 5: Aprovação de Vendas (Prioridade Baixa)

1. ⏳ Implementar listagem de vendas pendentes
2. ⏳ Implementar visualização de detalhes
3. ⏳ Implementar botão de aprovação (admin)
4. ⏳ Implementar notificações

### Fase 6: Melhorias e Polimento (Prioridade Baixa)

1. ⏳ Implementar filtros avançados
2. ⏳ Implementar busca
3. ⏳ Implementar paginação
4. ⏳ Implementar exportação de relatórios
5. ⏳ Implementar cancelamento de vendas

---

## ✅ Checklist de Desenvolvimento

### Antes de Começar

- [x] Schema do banco de dados definido
- [x] Rotas tRPC básicas criadas
- [x] Módulo de Produtos funcionando
- [x] Módulo de Parceiros funcionando
- [x] Canais de venda cadastrados
- [ ] Produtos com preços por canal
- [ ] Clientes com limite de crédito configurado

### Durante o Desenvolvimento

- [ ] Criar componente de listagem
- [ ] Criar modal de nova venda
- [ ] Implementar busca de produtos
- [ ] Implementar adição de itens
- [ ] Implementar cálculos
- [ ] Implementar validações
- [ ] Implementar baixa de estoque
- [ ] Implementar atualização de saldo
- [ ] Testar todos os fluxos
- [ ] Testar validações
- [ ] Testar edge cases

### Após o Desenvolvimento

- [ ] Testar venda de balcão
- [ ] Testar venda por delivery
- [ ] Testar venda a prazo
- [ ] Testar aprovação de vendas
- [ ] Verificar baixa de estoque
- [ ] Verificar atualização de saldo
- [ ] Documentar funcionalidades
- [ ] Criar guia de uso

---

## 🎯 Conclusão

Este documento define **TUDO** que precisamos para implementar o módulo de Vendas de forma completa e funcional.

**Próximos Passos:**
1. Revisar e validar esta especificação
2. Confirmar prioridades
3. Iniciar desenvolvimento pela Fase 1
4. Testar cada fase antes de avançar

**Estimativa de Tempo:**
- Fase 1: 2-3 horas
- Fase 2: 4-5 horas
- Fase 3: 2-3 horas
- Fase 4: 3-4 horas
- Fase 5: 2-3 horas
- Fase 6: 3-4 horas

**Total Estimado:** 16-22 horas de desenvolvimento

---

**Documento criado em:** 20 de Outubro de 2025  
**Última atualização:** 20 de Outubro de 2025  
**Status:** 📋 Aguardando aprovação para início do desenvolvimento

