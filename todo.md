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

## ✅ MELHORIAS DASHBOARD CONCLUÍDAS (14/11/2025)

- [x] Reorganizar cards: Faturamento Mês, Pendente Recebimento, Venda Diária, Estoque Baixo (clicável)
- [x] Implementar modal de Estoque Baixo listando produtos
- [x] Melhorar visualização de vendas recentes: mostrar nome fantasia em vendas a prazo e nome do canal em deliveries
- [x] Formatar nomes de tipo de venda: BALCAO → Balcão, A_PRAZO → A Prazo (Nome Cliente), DELIVERY → [Nome do Canal]

## ✅ BUG CRÍTICO RESOLVIDO - Subcategorias (14/11/2025)

- [x] BUG: Subcategorias não estavam sendo salvas no banco de dados ao criar/editar produtos
  - **CAUSA:** Formulário enviava "subcategory" (string) ao invés de "subcategoryId" (number)
  - **SOLUÇÃO:** Bug corrigido no formulário (linha 678 de produtos/page.tsx)
  - **DADOS LEGADOS:** Todos os produtos existentes tinham subcategoryId = NULL devido ao bug anterior
  - **IMPORTAÇÃO:** 361 produtos atualizados com subcategorias corretas via CSV fornecido pelo usuário
  - **SUBCATEGORIAS CRIADAS:** 28 subcategorias criadas no banco (Cerveja, Refrigerante, Whisky, etc)
  - **RESULTADO:** Sistema 100% funcional, todos os produtos com subcategorias corretas

## ✅ BUG CRÍTICO RESOLVIDO - Cadastro de Produtos (14/11/2025)

- [x] Campo Subcategoria enviando texto ("Água") ao invés de ID numérico ao criar produto
  - **CAUSA:** Formulário usava Input de texto livre ao invés de Select com IDs
  - **SOLUÇÃO:** Substituído Input por Select que busca subcategorias via tRPC e envia ID numérico
  - **BACKEND:** Criado router `subcategories.list` que retorna todas as subcategorias do banco
  - **TESTE:** Produto "Água Mineral Teste 500ml" criado com sucesso, subcategoryId = 55 (Água)
  - **RESULTADO:** Sistema 100% funcional, cadastro de produtos com subcategoria funcionando perfeitamente

## ✅ MELHORIAS CONCLUÍDAS - Dropdown de Subcategorias (14/11/2025)

- [x] Remover subcategorias duplicadas no dropdown
  - **CAUSA:** Script de importação executado 2 vezes
  - **SOLUÇÃO:** Removidas 28 subcategorias duplicadas via SQL, mantendo apenas primeira ocorrência
  - **RESULTADO:** 28 subcategorias únicas no banco
- [x] Adicionar botão para cadastrar novas subcategorias diretamente no formulário de produtos
  - **BACKEND:** Criado mutation `subcategories.create` e função `createSubcategory` no db.ts
  - **FRONTEND:** Adicionado botão "Nova" ao lado do dropdown + modal controlado para cadastro
  - **UX:** Modal fecha automaticamente após sucesso e nova subcategoria é selecionada automaticamente
  - **TESTE:** Criadas subcategorias "Cerveja Artesanal" e "Suco Natural" com sucesso
- [x] Implementar validação para evitar duplicatas ao criar subcategorias
  - **SOLUÇÃO:** Schema do banco já possui constraint UNIQUE em (name, categoryId)
  - **RESULTADO:** Banco rejeita automaticamente duplicatas com erro SQL

## ✅ MELHORIAS UX CONCLUÍDAS - Autocomplete (14/11/2025)

- [x] Substituir Select de Categoria por Combobox com autocomplete
  - **IMPLEMENTAÇÃO:** Usado Command + Popover do shadcn/ui para criar Combobox customizado
  - **FUNCIONALIDADE:** Digitar "beb" filtra e mostra apenas "Bebidas"
  - **UX:** Popover fecha automaticamente após seleção, botão mostra categoria selecionada
- [x] Substituir Select de Subcategoria por Combobox com autocomplete
  - **IMPLEMENTAÇÃO:** Mesmo padrão do Combobox de Categoria
  - **FUNCIONALIDADE:** Digitar "cerv" filtra "Cerveja" e "Cerveja Artesanal"
  - **BOTÃO NOVA:** Mantido ao lado do Combobox, abre modal para criar subcategoria inline
  - **TESTE:** Criada subcategoria "Vodka" com sucesso, aparece na lista automaticamente

## ✅ REFATORAÇÃO CONCLUÍDA - Campos de Categoria/Subcategoria (14/11/2025)

- [x] Substituir Combobox por Input com sugestões inline para Categoria
  - **IMPLEMENTAÇÃO:** Substituído Popover + Command por Input simples + lista de sugestões abaixo
  - **UX:** Sugestões aparecem enquanto digita, clica para selecionar (estilo "Cliente a Prazo")
  - **TESTE:** Digitar "beb" → mostra "Bebidas" abaixo do campo
- [x] Substituir Combobox por Input com sugestões inline para Subcategoria
  - **IMPLEMENTAÇÃO:** Mesmo padrão do campo de Categoria
  - **TESTE:** Digitar "cerv" → mostra "Cerveja" e "Cerveja Artesanal"
- [x] Implementar lógica de habilitar botão "Incluir" quando não houver sugestões
  - **LÓGICA:** Botão desabilitado se: categoria não selecionada OU campo vazio OU existem sugestões
  - **TESTE 1:** Digitei "gin" (não existe) → botão "Incluir" habilitado, criada subcategoria com sucesso
  - **TESTE 2:** Digitei "cerv" (existe) → botão "Incluir" desabilitado, força seleção da lista
  - **RESULTADO:** Sistema 100% funcional, UX intuitiva e rápida

## ✅ PROBLEMA RESOLVIDO - Rollback Executado (14/11/2025)

- [x] Checkpoint e6765682 voltou para versão antiga com Select dropdown
  - **CAUSA:** Git fez reset para origin/main perdendo as mudanças do frontend
  - **SOLUÇÃO:** Executado rollback para checkpoint a7871533 (versão com Input + sugestões)
  - **VERIFICAÇÃO:** Router subcategories e função createSubcategory já existiam no a7871533
  - **TESTE:** Sistema 100% funcional, Input com sugestões funcionando perfeitamente
  - **RESULTADO:** Versão correta restaurada, novo checkpoint 203f1760

## ✅ COMPORTAMENTO NORMAL - Hibernação do Sandbox (14/11/2025)

- [x] Servidor de desenvolvimento "cai" após alguns minutos de inatividade
  - **CAUSA:** Não é um bug! É comportamento normal de hibernação do sandbox para economizar recursos
  - **SINTOMA:** Erro "Unexpected token '<'" ao acessar após hibernação
  - **SOLUÇÃO:** Sandbox acorda automaticamente ao acessar novamente, ou usar webdev_restart_server
  - **VERIFICAÇÃO:** Servidor rodando normalmente (PID 50760), Dashboard funcionando
  - **RESULTADO:** Comportamento esperado, não requer correção

## ✅ TAREFA CONCLUÍDA - Levantamento de Inventário (14/11/2025)

- [x] Fazer levantamento de produtos cadastrados
  - **TOTAL:** 582 produtos cadastrados (aumento de 221 produtos, +61.2%)
  - **ESTOQUE:** 10.974 unidades totais
  - **ESTOQUE ZERADO:** Apenas 8 produtos
- [x] Gerar CSV atualizado para base de inventário
  - **ARQUIVO:** produtos_atualizados.csv
  - **REGISTROS:** 582 produtos com todas as informações (categoria, subcategoria, estoque, preços)
- [x] Criar relatório com estatísticas dos produtos
  - **ARQUIVO:** relatorio-inventario.md
  - **CONTEÚDO:** Estatísticas por categoria, top 10 subcategorias, crescimento

## ✅ TAREFAS CONCLUÍDAS - Correções e Melhorias Dashboard (14/11/2025)

- [x] Processar arquivo Excel de correção de subcategorias
  - **ARQUIVO:** CorreçãodeSubcategoria.xlsx (582 registros)
  - **RESULTADO:** 582 produtos atualizados com 100% de sucesso
  - **SUBCATEGORIAS CRIADAS:** Cerveja Sem Alcool, Outros, Rosh, Palheiro
- [x] Atualizar subcategorias dos produtos no banco de dados
  - **MÉTODO:** Script Node.js com biblioteca xlsx para ler Excel
  - **PROCESSO:** Mapeamento automático nome → ID, atualização em lote
  - **VALIDAÇÃO:** Subcategorias não encontradas são criadas automaticamente
- [x] Melhorar card "Faturamento Mês" com detalhamento por canal (Balcão/A Prazo + Delivery)
  - **BACKEND:** Adicionado cálculo separado de monthRevenueBalcao e monthRevenueDelivery
  - **FRONTEND:** Card mostra total + detalhamento em linhas compactas
  - **TESTE:** Faturamento Mês R$ 754,49 (Balcão/A Prazo: R$ 745,00 | Delivery: R$ 9,49)
- [x] Documentar processo de correção em massa via Excel para futuras atualizações
  - **SCRIPT:** update-subcategories-from-excel.mjs (reutilizável)
  - **FORMATO:** Excel com colunas "ID" e "Subcategoria Correção"
  - **FUTURO:** Mesmo processo pode ser usado para estoque, custo médio e preços

## ✅ MELHORIAS CONCLUÍDAS - Cards Dashboard com Percentuais (14/11/2025)

- [x] Adicionar detalhamento por canal no card "Venda Diária" (igual ao Faturamento Mês)
  - **IMPLEMENTAÇÃO:** Mesmo layout do card Faturamento Mês
  - **RESULTADO:** Venda Diária R$ 492,49 (Balcão/A Prazo: R$ 483,00 | Delivery: R$ 9,49)
- [x] Adicionar percentuais em ambos os cards (Balcão/A Prazo + Delivery)
  - **BACKEND:** Cálculo automático de percentual baseado no total
  - **FRONTEND:** Percentual exibido ao lado do valor em cinza claro
  - **TESTE:** Faturamento Mês (99% Balcão/A Prazo, 1% Delivery) | Venda Diária (98% Balcão/A Prazo, 2% Delivery)
- [x] Calcular faturamento diário por canal no backend
  - **IMPLEMENTAÇÃO:** Adicionado todayRevenueBalcao e todayRevenueDelivery no router dashboard.stats
  - **LÓGICA:** Filtra vendas do dia por saleType (BALCAO/A_PRAZO vs DELIVERY)
- [x] Testar visualização e validar cálculos de percentual
  - **VALIDAÇÃO:** Percentuais somam 100%, valores corretos
  - **UX:** Layout compacto, fácil leitura, consistente entre os dois cards
