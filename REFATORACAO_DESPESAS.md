# 🔄 Plano de Refatoração - Módulo de Despesas Operacionais

**Data:** 21 de outubro de 2025  
**Objetivo:** Ajustar o módulo de Despesas conforme feedback do usuário

---

## 📋 Mudanças Solicitadas

### 1. **Reordenação e Novos Campos do Formulário**

**Nova ordem dos campos:**

1. **Fornecedor** (primeiro campo)
   - ✅ Já existe integração com Parceiros
   - 🔄 Adicionar autocomplete/sugestão ao digitar (igual Compras)

2. **Tipo de Documento** (NOVO)
   - Opções: Nota Fiscal / Cupom
   - Campo obrigatório
   - Enum no banco de dados

3. **Número de Documento** (NOVO)
   - Campo texto para número da NF ou cupom
   - Validação de formato

4. **Categoria**
   - ✅ Já existe
   - 🔄 Adicionar autocomplete/sugestão ao digitar (igual Compras)

5. **Descrição**
   - ✅ Já existe
   - Manter como está

6. **Valor**
   - ✅ Já existe (atualmente "Valor Total")
   - Renomear para apenas "Valor"

7. **Forma de Pagamento** (MODIFICAR)
   - 🔄 Usar as mesmas formas de pagamento do módulo Compras
   - Verificar quais são as formas em Compras

8. **Data de Vencimento** (MODIFICAR)
   - 🔄 Permitir múltiplas datas (para parcelamento)
   - Substituir campos "Tipo de Pagamento", "Número de Parcelas", "Dia de Vencimento"

**Campos a REMOVER:**
- ❌ Tipo de Pagamento (À Vista/Parcelado)
- ❌ Número de Parcelas
- ❌ Dia de Vencimento
- ❌ Data da Primeira Parcela

**Campos a ADICIONAR:**
- ✅ Tipo de Documento
- ✅ Número de Documento
- ✅ Múltiplas datas de vencimento

---

### 2. **Integração com Layout Central**

**Problema Atual:**
- Ao clicar em "Despesas", o sistema "sai" do layout central
- Tem um dashboard próprio dentro do módulo

**Solução:**
- ❌ Remover dashboard local (cards de resumo)
- ✅ Integrar com o DashboardLayout existente
- ✅ Manter apenas a listagem de despesas
- ✅ Usar o mesmo padrão visual dos outros módulos (Produtos, Vendas, Compras)

**Referência:**
- Seguir o padrão da página de Compras ou Vendas

---

### 3. **Dashboard Único**

**Decisão:**
- Dashboard de Despesas será integrado ao dashboard principal (tela inicial)
- Por enquanto, focar apenas na funcionalidade de listagem e cadastro
- Dashboard consolidado será desenvolvido depois que todos os módulos estiverem prontos

---

## 🗄️ Mudanças no Banco de Dados

### Tabela `expenses` - Campos a ADICIONAR:

```typescript
documentType: mysqlEnum("documentType", ["NOTA_FISCAL", "CUPOM"]).notNull(),
documentNumber: varchar("documentNumber", { length: 50 }),
```

### Tabela `expenses` - Campos a MODIFICAR:

```typescript
// Renomear totalAmount para amount
amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),

// Remover campos relacionados a parcelamento
// (parcelamento será controlado por múltiplas datas de vencimento)
```

### Tabela `expenseInstallments` - MANTER

- Continuar usando para controlar múltiplas datas de vencimento
- Cada data = uma parcela/installment

---

## 🎨 Mudanças na Interface

### Estrutura da Página

**ANTES:**
```
Despesas Operacionais (página isolada)
├── Header próprio
├── Dashboard (3 cards)
├── Tabs (Despesas / Parcelas Pendentes)
└── Lista de despesas
```

**DEPOIS:**
```
DashboardLayout (layout central)
├── Menu lateral (já existe)
├── Header do sistema (já existe)
└── Conteúdo: Despesas
    ├── Botão "Nova Despesa"
    ├── Filtros (opcional)
    └── Lista de despesas
```

### Modal de Cadastro

**Nova ordem dos campos:**
1. Fornecedor (autocomplete)
2. Tipo de Documento (select)
3. Número de Documento (input)
4. Categoria (autocomplete)
5. Descrição (input)
6. Valor (input)
7. Forma de Pagamento (select - igual Compras)
8. Datas de Vencimento (múltiplas datas)
9. Observações (textarea)

---

## 🔍 Investigar Módulo de Compras

Precisamos verificar:
1. Como é o autocomplete de fornecedores em Compras
2. Quais são as formas de pagamento em Compras
3. Como é o layout da página de Compras
4. Como é a estrutura do formulário de Compras

---

## ✅ Checklist de Implementação

### Fase 1: Schema do Banco
- [ ] Adicionar campo `documentType`
- [ ] Adicionar campo `documentNumber`
- [ ] Renomear `totalAmount` para `amount`
- [ ] Remover campos de parcelamento (se necessário)
- [ ] Executar migration

### Fase 2: Backend
- [ ] Atualizar funções de banco de dados
- [ ] Atualizar rotas tRPC
- [ ] Ajustar validações

### Fase 3: Frontend
- [ ] Investigar estrutura de Compras
- [ ] Remover dashboard local
- [ ] Integrar com DashboardLayout
- [ ] Reordenar campos do formulário
- [ ] Adicionar autocomplete de fornecedor
- [ ] Adicionar autocomplete de categoria
- [ ] Adicionar campo Tipo de Documento
- [ ] Adicionar campo Número de Documento
- [ ] Implementar múltiplas datas de vencimento
- [ ] Usar formas de pagamento de Compras
- [ ] Remover aba "Parcelas Pendentes" (ou mover para outro lugar)

### Fase 4: Testes
- [ ] Testar cadastro com novos campos
- [ ] Testar autocomplete
- [ ] Testar múltiplas datas
- [ ] Testar integração com layout central

---

## 📝 Notas Técnicas

### Autocomplete
- Usar componente Combobox do shadcn/ui (se disponível)
- Ou criar componente customizado
- Filtrar ao digitar (client-side ou server-side)

### Múltiplas Datas de Vencimento
- Interface: Adicionar botão "+" para adicionar mais datas
- Cada data gera uma parcela automaticamente
- Valor dividido igualmente entre as datas
- Ou permitir valor customizado por data?

### Formas de Pagamento
- Verificar enum em Compras
- Usar o mesmo enum em Despesas
- Garantir consistência entre módulos

---

## 🚀 Próximos Passos

1. Investigar módulo de Compras
2. Atualizar schema do banco
3. Refatorar backend
4. Refatorar frontend
5. Testar tudo
6. Entregar para validação do usuário

