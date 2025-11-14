# Project TODO - ERP Adega Beira Rio

## 🔴 BUGS CRÍTICOS - PENDENTES (1 item)

- [ ] **Layout de vendas quebrado no mobile** - Resumo não tem layout responsivo adequado, tudo em scroll vertical único

## 🟢 FUNCIONALIDADES IMPLEMENTADAS (Verificadas em 13/11/2025)

- [x] Edição de produto composto mostra composições corretamente
- [x] Custo automático de produtos compostos baseado nos componentes (função updateCompositeProductCost)
- [x] Venda de produto composto dá baixa automática nos componentes (função updateProductStockWithCompositions)
- [x] Cadastro rápido de fornecedor em Compras (implementado e funcional)
- [x] Histórico de pagamentos mostra compras E despesas (query getPaymentHistory)

## 🟡 MELHORIAS DE UX - Baixa Prioridade (2 itens)

- [ ] Tooltips explicativos nos formulários
- [ ] Confirmação antes de deletar registros

## 📌 SPRINT ATUAL - ADIADO (1 item)

- [ ] Implementar filtro por subcategoria em Produtos

## ✅ CONCLUÍDO RECENTEMENTE (13/11/2025)

### Sprint Manhã/Tarde
- [x] Corrigir subcategorias duplicadas (VInho → Vinho, Ess → Essência)
- [x] Gerar arquivo CSV de produtos para inventário
- [x] Implementar campo "Nome Fantasia" em Parceiros
- [x] Travar campos de endereço após busca de CEP

### Bugs Corrigidos
- [x] Histórico de recebimentos agrupando múltiplos pagamentos (criada tabela receivablePayments)
- [x] Cliente "Gabriel" não aparece na busca ao registrar venda (filtro modificado para CUSTOMER ou BOTH)
- [x] Restringir botão "Desbloquear Campos de Endereço" apenas para admin
- [x] Vendas com saldo devedor não aparecem em Contas a Receber (corrigida lógica updateReceivableStatus)
- [x] Modal de produto composto fecha ao tentar adicionar segundo componente (adicionado type="button")

### Bug Composições de Produtos Compostos (RESOLVIDO DEFINITIVAMENTE)
- [x] Erro ao salvar produto composto após adicionar múltiplos componentes
- [x] Composições não aparecem na UI ao editar produto
- [x] **CAUSA RAIZ:** Sistema enviava `compositions: []` ao editar, backend deletava tudo
- [x] **SOLUÇÃO:** Campo compositions só é enviado ao criar (undefined ao editar = não modificar)

## 📊 FUNCIONALIDADES PRINCIPAIS IMPLEMENTADAS

### Módulo de Produtos
- ✅ CRUD completo de produtos
- ✅ Categorias e subcategorias
- ✅ Produtos compostos (pack/caixa) com composições
- ✅ Cálculo automático de custo baseado em componentes
- ✅ Múltiplos preços por canal de venda
- ✅ Controle de estoque mínimo
- ✅ Validação de EAN com dígito verificador
- ✅ Exportação para CSV (inventário)

### Módulo de Vendas
- ✅ Vendas Balcão, Delivery e A Prazo
- ✅ Múltiplos canais de venda (99Food, iFood, etc)
- ✅ Baixa automática de estoque (incluindo produtos compostos)
- ✅ Validação visual de estoque disponível
- ✅ Desconto e acréscimo
- ✅ Múltiplas formas de pagamento
- ✅ Integração com Contas a Receber

### Módulo de Compras
- ✅ Ordens de compra com múltiplos produtos
- ✅ Cadastro rápido de fornecedor
- ✅ Atualização automática de custo médio (FIFO)
- ✅ Atualização de custo de produtos compostos ao alterar componentes
- ✅ Parcelamento automático
- ✅ Integração com Contas a Pagar

### Módulo de Parceiros
- ✅ Clientes e Fornecedores
- ✅ Validação e formatação de CPF/CNPJ
- ✅ Busca automática de CEP (ViaCEP)
- ✅ Nome Fantasia
- ✅ Limite de crédito e saldo atual
- ✅ Controle de acesso a campos de endereço (admin only)

### Módulo Financeiro
- ✅ Contas a Receber (vendas a prazo)
- ✅ Contas a Pagar (compras e despesas)
- ✅ Histórico de pagamentos unificado
- ✅ Filtros avançados (data, fornecedor, documento, forma pagamento)
- ✅ Indicadores visuais de vencimento
- ✅ Pagamento parcial de parcelas

### Módulo de Despesas
- ✅ Cadastro de despesas com parcelamento
- ✅ Múltiplas categorias
- ✅ Integração com Contas a Pagar

### Dashboard
- ✅ Total de produtos cadastrados
- ✅ Produtos com estoque baixo
- ✅ Total de clientes
- ✅ Vendas do dia
- ✅ Vendas recentes
- ✅ Ações rápidas

### Recursos Gerais
- ✅ Autenticação via Manus OAuth
- ✅ Controle de acesso (admin/user)
- ✅ Atalhos de teclado globais
- ✅ Interface responsiva (desktop)
- ✅ Sincronização com GitHub
- ✅ Guia de instalação local

## 🎯 PRÓXIMAS SUGESTÕES

1. **Corrigir layout mobile de vendas** - Implementar grid responsivo com resumo lateral fixo em desktop
2. **Relatório de rentabilidade** - Comparar custo vs preço de venda por canal
3. **Histórico de alterações** - Log de auditoria para composições de produtos
4. **Filtro por subcategoria** - Facilitar navegação no catálogo de produtos
5. **Confirmações de exclusão** - Prevenir deleções acidentais

## ✅ FUNCIONALIDADES RESTAURADAS (14/11/2025)

- [x] Dashboard: Card "Saldo Pendente a Receber" (total de vendas a prazo pendentes) restaurado
- [x] Dashboard: Vendas recentes agora mostram horário (formato: "14/11/2025 às 08:30")

## 📊 IMPORTAÇÃO DE DADOS LEGADOS

- [ ] Importar histórico de vendas de 2022 até agora para análises futuras
  - Definir formato de importação (CSV, Excel, SQL)
  - Mapear campos do sistema antigo para o novo
  - Criar script de importação com validações
  - Testar importação com amostra pequena
  - Executar importação completa
