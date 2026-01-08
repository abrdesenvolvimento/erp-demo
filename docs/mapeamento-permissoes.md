# Mapeamento de Telas e Permissões - ERP Adega Beira Rio

## Perfis de Usuário

| Perfil | Descrição | Uso Típico |
|--------|-----------|------------|
| **admin** | Acesso total ao sistema | Dono, gerente |
| **operacional** | Operações do dia-a-dia | Funcionário do caixa |
| **consultor** | Visualização de relatórios | Contador, consultor externo |
| **user** | Acesso básico | Não utilizado atualmente |

---

## 1. DASHBOARD (Tela Inicial)

### Cards de Informação

| Card | Informação | Admin | Operacional | Consultor | Sugestão |
|------|------------|-------|-------------|-----------|----------|
| **Faturamento Mês** | Total vendas do mês + breakdown Balcão/Delivery | ✅ | ❌ | ✅ | Operacional não deve ver faturamento total |
| **Pendente Recebimento** | Total em aberto de vendas a prazo | ✅ | ❌ | ✅ | Informação financeira sensível |
| **Venda Diária** | Total vendas do dia + breakdown | ✅ | ✅ | ✅ | Operacional pode ver para acompanhar o dia |
| **Estoque Baixo** | Quantidade de produtos abaixo do mínimo | ✅ | ✅ | ✅ | Útil para todos |
| **Valor Total em Estoque** | Valor monetário do estoque (custo) | ✅ | ❌ | ❌ | Informação de custo muito sensível |
| **Produtos Vencendo** | Quantidade de produtos próximos do vencimento | ✅ | ✅ | ✅ | Útil para todos |
| **Compras do Mês** | Total de compras + breakdown por tipo doc | ✅ | ❌ | ✅ | Informação financeira |
| **Mg Líquida Delivery** | Margem líquida do delivery (descontando taxas) | ✅ | ❌ | ❌ | Informação estratégica |
| **Mg Bruta por Categoria** | Margem bruta geral e por categoria | ✅ | ❌ | ❌ | Informação estratégica |
| **Meta do Mês** | Progresso das metas de faturamento | ✅ | ❌ | ✅ | Consultor pode acompanhar |
| **Calendário de Vendas** | Visão mensal das vendas por dia | ✅ | ✅ | ✅ | Útil para todos |
| **Vendas Recentes** | Lista das últimas 10 vendas | ✅ | ✅ | ✅ | Útil para todos |

---

## 2. PRODUTOS

### Acesso à Tela
| Perfil | Pode Acessar |
|--------|--------------|
| Admin | ✅ |
| Operacional | ✅ |
| Consultor | ✅ |

### Informações e Ações

| Informação/Ação | Admin | Operacional | Consultor | Sugestão |
|-----------------|-------|-------------|-----------|----------|
| Ver lista de produtos | ✅ | ✅ | ✅ | Todos precisam |
| Ver nome, categoria, estoque | ✅ | ✅ | ✅ | Informação básica |
| Ver **Custo Médio** | ✅ | ❌ | ❌ | Informação sensível |
| Ver preços de venda | ✅ | ✅ | ✅ | Necessário para vendas |
| Criar produto | ✅ | ❌ | ❌ | Apenas admin |
| Editar produto | ✅ | ❌ | ❌ | Apenas admin |
| Ativar/Desativar produto | ✅ | ❌ | ❌ | Apenas admin |
| Ajustar estoque | ✅ | ❌ | ❌ | Apenas admin |
| Ver histórico de movimentações | ✅ | ✅ | ✅ | Útil para rastreio |
| Exportar para Excel | ✅ | ❌ | ✅ | Consultor pode precisar |

---

## 3. VENDAS

### Acesso à Tela
| Perfil | Pode Acessar |
|--------|--------------|
| Admin | ✅ |
| Operacional | ✅ |
| Consultor | ✅ |

### Informações e Ações

| Informação/Ação | Admin | Operacional | Consultor | Sugestão |
|-----------------|-------|-------------|-----------|----------|
| Ver lista de vendas | ✅ | ✅ | ✅ | Todos |
| Ver detalhes da venda | ✅ | ✅ | ✅ | Todos |
| Ver **lucro/margem** da venda | ✅ | ❌ | ❌ | Informação sensível |
| Criar nova venda | ✅ | ✅ | ❌ | Operacional precisa |
| Editar venda | ✅ | ❌ | ❌ | Apenas admin |
| Cancelar venda | ✅ | ❌ | ❌ | Apenas admin |
| Filtrar por período | ✅ | ✅ | ✅ | Todos |
| Exportar vendas | ✅ | ❌ | ✅ | Consultor pode precisar |

---

## 4. PARCEIROS (Clientes/Fornecedores)

### Acesso à Tela
| Perfil | Pode Acessar |
|--------|--------------|
| Admin | ✅ |
| Operacional | ✅ |
| Consultor | ✅ |

### Informações e Ações

| Informação/Ação | Admin | Operacional | Consultor | Sugestão |
|-----------------|-------|-------------|-----------|----------|
| Ver lista de parceiros | ✅ | ✅ | ✅ | Todos |
| Ver dados básicos (nome, telefone) | ✅ | ✅ | ✅ | Todos |
| Ver **limite de crédito** | ✅ | ✅ | ✅ | Operacional precisa para vendas a prazo |
| Ver **saldo devedor** | ✅ | ✅ | ✅ | Operacional precisa |
| Criar parceiro | ✅ | ❌ | ❌ | Apenas admin |
| Editar parceiro | ✅ | ❌ | ❌ | Apenas admin |
| Alterar limite de crédito | ✅ | ❌ | ❌ | Apenas admin |

---

## 5. COMPRAS

### Acesso à Tela
| Perfil | Pode Acessar |
|--------|--------------|
| Admin | ✅ |
| Operacional | ❌ |
| Consultor | ✅ (somente leitura) |

### Informações e Ações

| Informação/Ação | Admin | Operacional | Consultor | Sugestão |
|-----------------|-------|-------------|-----------|----------|
| Ver lista de compras | ✅ | ❌ | ✅ | Consultor pode auditar |
| Ver detalhes (itens, valores) | ✅ | ❌ | ✅ | Consultor pode auditar |
| Criar compra | ✅ | ❌ | ❌ | Apenas admin |
| Editar compra | ✅ | ❌ | ❌ | Apenas admin |
| Confirmar/Cancelar compra | ✅ | ❌ | ❌ | Apenas admin |

---

## 6. DESPESAS

### Acesso à Tela
| Perfil | Pode Acessar |
|--------|--------------|
| Admin | ✅ |
| Operacional | ❌ |
| Consultor | ✅ (somente leitura) |

### Informações e Ações

| Informação/Ação | Admin | Operacional | Consultor | Sugestão |
|-----------------|-------|-------------|-----------|----------|
| Ver lista de despesas | ✅ | ❌ | ✅ | Consultor pode auditar |
| Ver categorias e valores | ✅ | ❌ | ✅ | Consultor pode auditar |
| Criar despesa | ✅ | ❌ | ❌ | Apenas admin |
| Editar despesa | ✅ | ❌ | ❌ | Apenas admin |
| Cancelar despesa | ✅ | ❌ | ❌ | Apenas admin |

---

## 7. CONTAS A RECEBER

### Acesso à Tela
| Perfil | Pode Acessar |
|--------|--------------|
| Admin | ✅ |
| Operacional | ✅ |
| Consultor | ✅ (somente leitura) |

### Informações e Ações

| Informação/Ação | Admin | Operacional | Consultor | Sugestão |
|-----------------|-------|-------------|-----------|----------|
| Ver lista de clientes com saldo | ✅ | ✅ | ✅ | Operacional precisa |
| Ver detalhes de débitos | ✅ | ✅ | ✅ | Operacional precisa |
| Registrar pagamento | ✅ | ✅ | ❌ | Operacional recebe pagamentos |
| Lançar débito manual | ✅ | ✅ | ❌ | Operacional pode precisar |

---

## 8. CONTAS A PAGAR

### Acesso à Tela
| Perfil | Pode Acessar |
|--------|--------------|
| Admin | ✅ |
| Operacional | ❌ |
| Consultor | ✅ (somente leitura) |

### Informações e Ações

| Informação/Ação | Admin | Operacional | Consultor | Sugestão |
|-----------------|-------|-------------|-----------|----------|
| Ver lista de fornecedores com saldo | ✅ | ❌ | ✅ | Consultor pode auditar |
| Ver detalhes de parcelas | ✅ | ❌ | ✅ | Consultor pode auditar |
| Registrar pagamento | ✅ | ❌ | ❌ | Apenas admin |

---

## 9. ANÁLISES

### Acesso às Telas de Análise
| Tela | Admin | Operacional | Consultor |
|------|-------|-------------|-----------|
| Análise de Vendas | ✅ | ❌ | ❌ |
| Análise de Faturamento | ✅ | ❌ | ✅ |
| Análise Delivery | ✅ | ❌ | ❌ |
| Análise por Canal | ✅ | ❌ | ❌ |
| Análise de Despesas | ✅ | ❌ | ✅ |
| Metas | ✅ | ❌ | ❌ |
| Fechamento | ✅ | ❌ | ❌ |

**Sugestão:** Consultor deveria ter acesso a Metas e Fechamento em modo somente leitura?

---

## 10. GERENCIAR USUÁRIOS

### Acesso à Tela
| Perfil | Pode Acessar |
|--------|--------------|
| Admin | ✅ |
| Operacional | ❌ |
| Consultor | ❌ |

---

## Resumo de Informações Sensíveis

| Informação | Quem pode ver |
|------------|---------------|
| Custo médio de produtos | Apenas Admin |
| Margem/Lucro de vendas | Apenas Admin |
| Valor total do estoque | Apenas Admin |
| Margem bruta por categoria | Apenas Admin |
| Margem líquida delivery | Apenas Admin |
| Faturamento mensal | Admin e Consultor |
| Compras e despesas | Admin e Consultor |
| Limite de crédito de clientes | Admin e Operacional |

---

## Alterações Necessárias

### Dashboard (Home.tsx)
- [ ] Ocultar card "Faturamento Mês" para Operacional
- [ ] Ocultar card "Pendente Recebimento" para Operacional
- [ ] Ocultar card "Compras do Mês" para Operacional
- [ ] Ocultar card "Meta do Mês" para Operacional
- [x] Ocultar card "Valor Total em Estoque" para não-admin (já implementado)
- [x] Ocultar card "Mg Líquida Delivery" para não-admin (já implementado)
- [x] Ocultar card "Mg Bruta por Categoria" para não-admin (já implementado)

### Produtos (Produtos.tsx)
- [x] Ocultar coluna "Custo Médio" para não-admin (já implementado)
- [ ] Verificar se consultor deveria ver custo (atualmente sim)

### Vendas (Vendas.tsx)
- [ ] Ocultar coluna de margem/lucro para não-admin (se existir)

### Menu Lateral (DashboardLayout.tsx)
- [x] Permissões de menu já configuradas por role
