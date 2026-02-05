# Mapeamento Contábil - ERP Adega Beira Rio

**Versão:** 1.0  
**Data:** 04/02/2026  
**Autor:** Aurora (Manus)

---

## 1. Visão Geral

Este documento define as regras de contabilização automática do sistema ERP Adega Beira Rio. Cada transação financeira gera lançamentos contábeis seguindo o princípio da partida dobrada (débito = crédito).

---

## 2. Princípios Gerais

### 2.1 Partida Dobrada
Todo lançamento contábil deve ter:
- **Débito** = **Crédito** (valores iguais)
- Mínimo de 2 contas envolvidas por lançamento

### 2.2 Momento do Lançamento
- **Regime de Competência**: Lançamentos são feitos na data da transação (venda, compra, despesa)
- **Regime de Caixa**: Movimentações de caixa são registradas na data do pagamento/recebimento

### 2.3 Estrutura do Plano de Contas
| Grupo | Natureza | Descrição |
|-------|----------|-----------|
| 1 | Devedora | ATIVO |
| 2 | Credora | PASSIVO |
| 3 | Credora | PATRIMÔNIO LÍQUIDO |
| 4 | Credora | RECEITAS |
| 5 | Devedora | CUSTOS |
| 6 | Devedora | DESPESAS |

---

## 3. Eventos de Contabilização

### 3.1 VENDAS

#### 3.1.1 Venda Balcão (À Vista)
| Débito | Crédito | Valor |
|--------|---------|-------|
| 1.1.1.01 - Caixa Geral | 4.1.1.01 - Receita de Vendas (Balcão) | Valor da venda |
| 5.1.1.01 - CMV | 1.1.3.01 - Estoque de Mercadorias | Custo médio dos produtos |

#### 3.1.2 Venda A Prazo
| Débito | Crédito | Valor |
|--------|---------|-------|
| 1.1.2.01 - Clientes A Prazo | 4.1.1.02 - Receita de Vendas (A Prazo) | Valor da venda |
| 5.1.1.01 - CMV | 1.1.3.01 - Estoque de Mercadorias | Custo médio dos produtos |

#### 3.1.3 Venda Delivery
| Débito | Crédito | Valor |
|--------|---------|-------|
| 1.1.1.01 - Caixa Geral | 4.1.1.03 - Receita de Vendas (Delivery) | Valor da venda |
| 5.1.1.01 - CMV | 1.1.3.01 - Estoque de Mercadorias | Custo médio dos produtos |

**Observação:** Para vendas iFood, pode-se usar conta específica 1.1.2.02 - iFood a Receber.

---

### 3.2 COMPRAS

#### 3.2.1 Entrada de Mercadorias (Compra Confirmada)
| Débito | Crédito | Valor |
|--------|---------|-------|
| 1.1.3.01 - Estoque de Mercadorias | 2.1.1.01 - Fornecedores | Valor total da compra |

**Regra de Rateio:** Frete, desconto e acréscimos são rateados no custo dos produtos (não geram lançamentos separados).

#### 3.2.2 Pagamento de Compra
| Débito | Crédito | Valor |
|--------|---------|-------|
| 2.1.1.01 - Fornecedores | 1.1.1.01 - Caixa Geral | Valor pago |

#### 3.2.3 Juros por Atraso no Pagamento
| Débito | Crédito | Valor |
|--------|---------|-------|
| 6.3.1.01 - Juros Pagos | 1.1.1.01 - Caixa Geral | Valor dos juros |

---

### 3.3 DESPESAS

#### 3.3.1 Registro de Despesa
| Débito | Crédito | Valor |
|--------|---------|-------|
| Conta Gerencial (mapeada) | 2.1.2.01 - Contas a Pagar | Valor da despesa |

**Mapeamento:** A conta de débito é determinada pela Conta Gerencial da despesa, que possui amarração com o Plano Contábil.

Exemplos de mapeamento:
| Conta Gerencial | Conta Contábil |
|-----------------|----------------|
| Aluguel (6.1.1.01) | 6.1.1.01 - Aluguel |
| Energia Elétrica (6.1.2.01) | 6.1.2.01 - Energia Elétrica |
| Software e Sistemas (6.1.2.02) | 6.1.2.02 - Software e Sistemas |
| Embalagens (5.2.1.01) | 5.2.1.01 - Embalagens |
| Material de Consumo (5.2.1.05) | 5.2.1.05 - Material de Consumo |

#### 3.3.2 Pagamento de Despesa (À Vista)
**Baixa Automática:** Despesas com forma de pagamento "À Vista" são automaticamente baixadas no momento da criação.

| Débito | Crédito | Valor |
|--------|---------|-------|
| Conta Gerencial (mapeada) | 1.1.1.01 - Caixa Geral | Valor da despesa |

#### 3.3.3 Pagamento de Despesa (A Prazo)
| Débito | Crédito | Valor |
|--------|---------|-------|
| 2.1.2.01 - Contas a Pagar | 1.1.1.01 - Caixa Geral | Valor pago |

#### 3.3.4 Juros por Atraso no Pagamento
| Débito | Crédito | Valor |
|--------|---------|-------|
| 6.3.1.01 - Juros Pagos | 1.1.1.01 - Caixa Geral | Valor dos juros |

---

### 3.4 OUTRAS RECEITAS

#### 3.4.1 Registro de Receita
| Débito | Crédito | Valor |
|--------|---------|-------|
| 1.1.1.xx - Conta de Banco | Conta Gerencial de Receita (mapeada) | Valor da receita |

Exemplos de mapeamento:
| Conta Gerencial | Conta Contábil |
|-----------------|----------------|
| Receita de Aluguel (ROR001) | 4.2.1.01 - Receita de Aluguel |
| Receita de Serviços (ROR002) | 4.2.1.02 - Receita de Serviços |
| Outras Receitas (ROR003) | 4.2.1.03 - Outras Receitas |
| Juros Recebidos (RFI001) | 4.3.1.01 - Juros Recebidos |
| Descontos Obtidos (RFI002) | 4.3.1.02 - Descontos Obtidos |

---

### 3.5 CONTAS A RECEBER

#### 3.5.1 Lançamento de Débito (Nova Cobrança)
| Débito | Crédito | Valor |
|--------|---------|-------|
| 1.1.2.01 - Clientes A Prazo | Conta Gerencial de Receita (mapeada) | Valor do débito |

#### 3.5.2 Recebimento de Cliente
| Débito | Crédito | Valor |
|--------|---------|-------|
| 1.1.1.01 - Caixa Geral | 1.1.2.01 - Clientes A Prazo | Valor recebido |

#### 3.5.3 Desconto Concedido
| Débito | Crédito | Valor |
|--------|---------|-------|
| 6.2.1.01 - Descontos Concedidos | 1.1.2.01 - Clientes A Prazo | Valor do desconto |

#### 3.5.4 Juros Recebidos (Atraso)
| Débito | Crédito | Valor |
|--------|---------|-------|
| 1.1.1.01 - Caixa Geral | 4.3.1.01 - Juros Recebidos | Valor dos juros |

---

### 3.6 CONTAS A PAGAR

#### 3.6.1 Pagamento com Juros
| Débito | Crédito | Valor |
|--------|---------|-------|
| 2.1.2.01 - Contas a Pagar | 1.1.1.01 - Caixa Geral | Valor original |
| 6.3.1.01 - Juros Pagos | 1.1.1.01 - Caixa Geral | Valor dos juros |

#### 3.6.2 Pagamento com Desconto
| Débito | Crédito | Valor |
|--------|---------|-------|
| 2.1.2.01 - Contas a Pagar | 1.1.1.01 - Caixa Geral | Valor pago |
| 2.1.2.01 - Contas a Pagar | 4.3.1.02 - Descontos Obtidos | Valor do desconto |

---

## 4. Regras Especiais

### 4.1 Cancelamento de Transações
Ao cancelar uma transação, os lançamentos contábeis devem ser **estornados** (invertidos):
- Débitos viram Créditos
- Créditos viram Débitos

### 4.2 Edição de Transações
- **Antes da contabilização:** Edição livre
- **Após contabilização:** Deve gerar lançamento de ajuste (diferença)

### 4.3 Timezone
Todas as datas de lançamento seguem o fuso horário de São Paulo (America/Sao_Paulo).

### 4.4 CMV (Custo das Mercadorias Vendidas)
O CMV é calculado com base no **custo médio** dos produtos vendidos:
```
CMV = Σ (quantidade vendida × custo médio do produto)
```

---

## 5. Formas de Pagamento e Baixa

| Forma de Pagamento | Vai para Contas a Pagar? | Baixa |
|-------------------|--------------------------|-------|
| À Vista | ✅ Sim | **Automática** |
| Boleto | ✅ Sim | Manual |
| Débito Automático | ✅ Sim | Manual |
| Crédito G | ✅ Sim | Manual |
| Crédito R | ✅ Sim | Manual |
| Crédito ABR | ✅ Sim | Manual |
| Perdas | ❌ Não | N/A |

---

## 6. Próximos Passos

### 6.1 Implementação Pendente
- [ ] Contabilização automática em tempo real (ao criar transações)
- [ ] Registro de juros efetivos no pagamento (Contas a Pagar)
- [ ] Registro de juros recebidos (Contas a Receber)
- [ ] Estorno automático ao cancelar transações
- [ ] Trava de edição após contabilização (3 dias)

### 6.2 Validações Necessárias
- [ ] Garantir que toda Conta Gerencial tenha amarração contábil
- [ ] Validar partida dobrada em todos os lançamentos
- [ ] Verificar consistência entre DRE e Balancete

---

## 7. Histórico de Versões

| Versão | Data | Autor | Alterações |
|--------|------|-------|------------|
| 1.0 | 04/02/2026 | Aurora | Documento inicial |
