# 📖 Guia Rápido - Módulo de Despesas Operacionais

## Como Usar o Módulo de Despesas

### 1️⃣ Acessar o Módulo

No menu lateral do ERP, clique em **"Despesas"** (ícone laranja).

---

### 2️⃣ Cadastrar uma Nova Despesa

#### Despesa À Vista

1. Clique no botão **"+ Nova Despesa"** (canto superior direito)
2. Preencha os campos:
   - **Categoria:** Selecione a categoria (ex: Aluguel, Energia, etc.)
   - **Fornecedor:** (Opcional) Selecione o fornecedor
   - **Descrição:** Descreva a despesa (ex: "Aluguel de outubro/2025")
   - **Valor Total:** Digite o valor (ex: 2500.00)
   - **Data de Vencimento:** Selecione a data
   - **Tipo de Pagamento:** Deixe em "À Vista"
3. Clique em **"Salvar Despesa"**

#### Despesa Parcelada

1. Clique no botão **"+ Nova Despesa"**
2. Preencha os campos básicos (categoria, descrição, valor total, etc.)
3. Selecione **"Parcelado"** em "Tipo de Pagamento"
4. Preencha:
   - **Número de Parcelas:** Quantidade de parcelas (ex: 3)
   - **Dia de Vencimento:** Dia do mês para vencimento (ex: 15)
   - **Data da Primeira Parcela:** Data de vencimento da primeira parcela
5. Clique em **"Salvar Despesa"**

**Exemplo:**
- Valor Total: R$ 900,00
- Parcelas: 3x
- Resultado: 3 parcelas de R$ 300,00 cada

---

### 3️⃣ Visualizar Despesas

Na aba **"Despesas"**, você verá:
- Lista de todas as despesas cadastradas
- Informações: Descrição, Categoria, Tipo (À Vista/Parcelado), Valor, Status
- Badge de status: ATIVA, PAGA, CANCELADA

---

### 4️⃣ Gerenciar Parcelas Pendentes

1. Clique na aba **"Parcelas Pendentes"**
2. Veja todas as parcelas aguardando pagamento
3. Informações exibidas:
   - Descrição da despesa
   - Categoria e número da parcela
   - Valor da parcela
   - Data de vencimento
   - Dias até o vencimento

---

### 5️⃣ Pagar uma Parcela

1. Na aba **"Parcelas Pendentes"**, localize a parcela
2. Clique no botão **"Pagar"**
3. No modal "Registrar Pagamento":
   - **Data do Pagamento:** Confirme ou altere a data
   - **Valor Pago:** Confirme ou altere o valor
   - **Forma de Pagamento:** Selecione (Dinheiro, PIX, Cartão, etc.)
   - **Observações:** (Opcional) Adicione informações extras
4. Clique em **"Confirmar Pagamento"**

**Resultado:**
- Parcela marcada como PAGA
- Removida da lista de pendentes
- Contadores atualizados automaticamente

---

### 6️⃣ Entender o Dashboard

#### Card "Despesas Ativas"
Mostra o número total de despesas com status ATIVA (que ainda têm parcelas pendentes).

#### Card "Parcelas Pendentes"
Mostra quantas parcelas estão aguardando pagamento.

#### Card "Total Pendente"
Mostra a soma de todos os valores das parcelas pendentes.

**Exemplo:**
```
Despesas Ativas: 3
Parcelas Pendentes: 4
Total Pendente: R$ 3.400,00
```

---

## 💡 Dicas Importantes

### Categorias Disponíveis
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

### Formas de Pagamento
- Dinheiro
- PIX
- Cartão de Débito
- Cartão de Crédito
- Transferência
- Boleto

### Status de Despesas
- **ATIVA:** Despesa com parcelas pendentes
- **PAGA:** Todas as parcelas foram pagas
- **CANCELADA:** Despesa cancelada

### Status de Parcelas
- **PENDENTE:** Aguardando pagamento
- **PAGO:** Parcela paga
- **VENCIDO:** Parcela com vencimento atrasado
- **CANCELADO:** Parcela cancelada

---

## ⚠️ Observações

1. **Fornecedor é opcional:** Você pode cadastrar uma despesa sem vincular a um fornecedor.

2. **Parcelas automáticas:** Ao criar uma despesa parcelada, as parcelas são criadas automaticamente com valores iguais.

3. **Pagamento parcial:** Você pode pagar um valor diferente do valor da parcela (útil para multas, descontos, etc.).

4. **Histórico:** Todas as parcelas pagas ficam registradas no sistema com data, valor e forma de pagamento.

5. **Cancelamento:** Ao cancelar uma despesa, todas as parcelas pendentes são canceladas automaticamente, mas as já pagas são mantidas no histórico.

---

## 🔄 Fluxo Completo de Uso

```
1. Cadastrar Despesa
   ↓
2. Sistema cria parcelas automaticamente
   ↓
3. Visualizar parcelas pendentes
   ↓
4. Pagar parcelas conforme vencimento
   ↓
5. Dashboard atualiza automaticamente
   ↓
6. Quando todas as parcelas forem pagas
   → Despesa muda para status PAGA
```

---

## 📞 Suporte

Para dúvidas ou problemas, consulte a documentação completa em `MODULO_DESPESAS_COMPLETO.md`.

---

**Última atualização:** 21 de outubro de 2025

