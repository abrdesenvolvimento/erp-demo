# ✅ Refatoração do Módulo de Despesas Operacionais - COMPLETA

**Data:** 21 de outubro de 2025  
**Status:** ✅ Implementado e Testado

---

## 📋 Mudanças Solicitadas pelo Usuário

### 1. **Reordenação e Novos Campos do Formulário**

**Nova ordem implementada:**

1. ✅ **Fornecedor** (primeiro campo)
   - Autocomplete com busca ao digitar
   - Opcional
   - Igual ao módulo Compras

2. ✅ **Tipo de Documento** (NOVO)
   - Opções: Nota Fiscal / Cupom
   - Campo obrigatório

3. ✅ **Número de Documento** (NOVO)
   - Campo texto para número da NF ou cupom
   - Opcional

4. ✅ **Categoria**
   - Autocomplete com busca ao digitar
   - Obrigatório
   - Igual ao módulo Compras

5. ✅ **Descrição**
   - Campo texto
   - Obrigatório

6. ✅ **Valor**
   - Campo numérico
   - Obrigatório

7. ✅ **Forma de Pagamento**
   - Mesmas formas de pagamento do módulo Compras:
     - Boleto
     - Crédito G
     - Crédito R
     - Crédito ABR
     - À Vista
     - Débito Automático
   - Obrigatório

8. ✅ **Datas de Vencimento** (NOVO - substitui parcelamento)
   - Permite múltiplas datas
   - Botão "Adicionar Data" para criar parcelas
   - Valor dividido igualmente entre as datas
   - Mínimo 1 data

9. ✅ **Observações**
   - Campo de texto livre
   - Opcional

---

### 2. **Integração com Layout Central**

✅ **Implementado:**
- ❌ Removido dashboard local (cards de resumo)
- ✅ Integrado com DashboardLayout existente
- ✅ Mantido apenas a listagem de despesas
- ✅ Segue o mesmo padrão visual dos outros módulos

**Antes:**
```
Despesas Operacionais (página isolada)
├── Header próprio
├── Dashboard (3 cards)
├── Tabs (Despesas / Parcelas Pendentes)
└── Lista de despesas
```

**Depois:**
```
DashboardLayout (layout central)
├── Menu lateral (já existe)
├── Header do sistema (já existe)
└── Conteúdo: Despesas
    ├── Título e subtítulo
    ├── Botão "Nova Despesa"
    └── Lista de despesas
```

---

## 🗄️ Mudanças no Banco de Dados

### Tabela `expenses` - Estrutura NOVA:

```sql
CREATE TABLE expenses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  supplierId INT,                              -- Fornecedor (opcional)
  docType ENUM('NOTA_FISCAL', 'CUPOM') NOT NULL, -- Tipo de documento
  docNumber VARCHAR(100),                       -- Número do documento
  categoryId INT NOT NULL,                      -- Categoria
  description VARCHAR(255) NOT NULL,            -- Descrição
  amount DECIMAL(10, 2) NOT NULL,               -- Valor (renomeado de totalAmount)
  paymentMethod VARCHAR(50) NOT NULL,           -- Forma de pagamento
  notes TEXT,                                   -- Observações
  status ENUM('ATIVA', 'PAGA', 'CANCELADA') NOT NULL DEFAULT 'ATIVA',
  createdBy VARCHAR(64) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX category_idx (categoryId),
  INDEX status_idx (status),
  INDEX supplier_idx (supplierId)
)
```

### Tabela `expenseInstallments` - Atualizada:

```sql
ALTER TABLE expenseInstallments
  MODIFY COLUMN paymentMethod VARCHAR(50); -- Mesmas formas de Compras
```

### Campos REMOVIDOS:
- ❌ `totalAmount` → renomeado para `amount`
- ❌ `paymentType` (À Vista/Parcelado)
- ❌ `installments` (número de parcelas)
- ❌ `dueDay` (dia do vencimento)
- ❌ `firstDueDate` (primeira data)

### Campos ADICIONADOS:
- ✅ `docType` (ENUM)
- ✅ `docNumber` (VARCHAR)
- ✅ `amount` (renomeado)
- ✅ `paymentMethod` (VARCHAR - igual Compras)

---

## 🔧 Mudanças no Backend

### Arquivo: `server/routers.ts`

**Rota `expenses.create` - Atualizada:**

```typescript
create: protectedProcedure
  .input(z.object({
    supplierId: z.number().optional(),
    docType: z.enum(["NOTA_FISCAL", "CUPOM"]),
    docNumber: z.string().optional(),
    categoryId: z.number(),
    description: z.string().min(3),
    amount: z.string(),
    paymentMethod: z.string(),
    dueDates: z.array(z.date()).min(1), // Array de datas
    notes: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    // Criar despesa
    const expenseId = await db.createExpense({...});
    
    // Criar parcelas baseadas nas datas fornecidas
    const totalAmount = parseFloat(input.amount);
    const installmentAmount = (totalAmount / input.dueDates.length).toFixed(2);
    
    for (let i = 0; i < input.dueDates.length; i++) {
      await db.createExpenseInstallment({
        expenseId,
        installmentNumber: i + 1,
        amount: installmentAmount,
        dueDate: input.dueDates[i],
        status: "PENDENTE",
      });
    }
    
    return { id: expenseId, success: true };
  }),
```

### Arquivo: `server/db.ts`

**Função `getExpenses` - Atualizada:**
- Removidas referências a `firstDueDate`
- Filtros de data agora controlados pelas parcelas

---

## 🎨 Mudanças no Frontend

### Arquivo: `client/src/pages/Despesas.tsx`

**Completamente reescrito** seguindo o padrão de `Compras.tsx`:

**Componentes utilizados:**
- ✅ `DashboardLayout` (layout central)
- ✅ `Command` + `Popover` (autocomplete)
- ✅ `Select` (dropdowns)
- ✅ `Input` (campos de texto)
- ✅ `Textarea` (observações)
- ✅ `Button` (ações)

**Fluxo de tela:**
1. **Listagem** - Página principal com lista de despesas
2. **Criação** - Tela fullscreen com formulário (igual Compras)
3. **Cancelamento** - Confirmação antes de descartar

**Features implementadas:**
- ✅ Autocomplete de fornecedor (busca por nome ou documento)
- ✅ Autocomplete de categoria (busca por nome)
- ✅ Múltiplas datas de vencimento
- ✅ Botão "Adicionar Data" para criar parcelas
- ✅ Botão de remover data (ícone lixeira)
- ✅ Cálculo automático de parcelas
- ✅ Validações de formulário
- ✅ Mensagens de sucesso/erro (toast)

---

## ✅ Testes Realizados

### 1. **Navegação**
- ✅ Menu lateral visível
- ✅ Botão "Despesas" destacado quando ativo
- ✅ Integração com DashboardLayout

### 2. **Listagem**
- ✅ Título "Despesas Operacionais"
- ✅ Subtítulo "Gerencie as despesas da empresa"
- ✅ Botão "Nova Despesa"
- ✅ Mensagem "Nenhuma despesa cadastrada" quando vazio

### 3. **Formulário de Criação**
- ✅ Todos os campos na ordem correta
- ✅ Autocomplete de fornecedor funcionando
- ✅ Autocomplete de categoria funcionando
- ✅ Tipo de documento (Cupom/Nota Fiscal)
- ✅ Número de documento
- ✅ Descrição
- ✅ Valor
- ✅ Forma de pagamento (6 opções)
- ✅ Datas de vencimento (múltiplas)
- ✅ Botão "Adicionar Data"
- ✅ Observações
- ✅ Botões "Cancelar" e "Salvar Despesa"

### 4. **Validações**
- ✅ Categoria obrigatória
- ✅ Descrição obrigatória
- ✅ Valor obrigatório e > 0
- ✅ Forma de pagamento obrigatória
- ✅ Pelo menos 1 data de vencimento

---

## 📊 Estatísticas da Refatoração

### Banco de Dados:
- **3 campos adicionados** (docType, docNumber, paymentMethod)
- **1 campo renomeado** (totalAmount → amount)
- **5 campos removidos** (paymentType, installments, dueDay, firstDueDate)
- **1 tabela recriada** (expenses)

### Backend:
- **1 rota atualizada** (expenses.create)
- **1 função atualizada** (getExpenses)
- **Nova lógica** de criação de parcelas baseada em datas

### Frontend:
- **~600 linhas de código** reescritas
- **Componente completamente refatorado**
- **2 telas** (listagem + criação)
- **8 campos** no formulário
- **2 autocompletes** implementados
- **Múltiplas datas** de vencimento

---

## 🎯 Próximos Passos

Com o módulo de Despesas refatorado, o sistema está pronto para:

1. **Módulo de Contas a Receber**
   - Gerenciar pagamentos das vendas A Prazo
   - Integrar com módulo de Vendas

2. **Fluxo de Caixa**
   - Consolidar dados de:
     - ✅ Compras (contas a pagar)
     - ✅ Despesas Operacionais
     - 🔄 Contas a Receber (próximo)
   - Dashboard unificado

3. **Relatórios**
   - Relatórios de despesas por categoria
   - Relatórios de despesas por período
   - Análise de custos operacionais

---

## 📝 Notas Técnicas

### Autocomplete
- Usa componente `Command` do shadcn/ui
- Filtragem client-side
- Busca case-insensitive
- Exibe informações adicionais (documento do fornecedor, descrição da categoria)

### Múltiplas Datas de Vencimento
- Interface: Botão "+" para adicionar mais datas
- Cada data gera uma parcela automaticamente
- Valor dividido igualmente entre as datas
- Data padrão: 30 dias à frente
- Próximas datas: +1 mês da anterior

### Formas de Pagamento
- Mesmas do módulo Compras
- Armazenadas como VARCHAR (não ENUM)
- Permite flexibilidade futura

---

## 🚀 Conclusão

✅ **Todas as mudanças solicitadas foram implementadas com sucesso!**

O módulo de Despesas Operacionais agora:
- Segue o mesmo padrão visual e de UX do módulo Compras
- Está integrado ao layout central do sistema
- Possui todos os campos solicitados na ordem correta
- Suporta múltiplas datas de vencimento
- Está pronto para integração com o Fluxo de Caixa

**Status:** ✅ Pronto para uso e testes do usuário!

