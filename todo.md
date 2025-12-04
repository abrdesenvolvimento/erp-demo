# Project TODO - ERP Adega Beira Rio

## 🚀 NOVAS FUNCIONALIDADES SOLICITADAS - PRÉ-PUBLICAÇÃO (19/11/2025)

### Alta Prioridade

- [x] **Alerta de Produtos Próximos ao Vencimento**
  - Sistema já possui campo de data de vencimento nos produtos
  - Implementar card no dashboard com alerta visual de produtos vencendo
  - Definir prazo de alerta (ex: 30 dias antes do vencimento)
  - Listar produtos com vencimento próximo/vencido
  - Permitir filtro por categoria/subcategoria
  - Adicionar notificação visual (badge vermelho/laranja)

- [x] **Card "Valor Total em Estoque" no Dashboard**
  - Calcular valor total: soma de (currentStock × avgCost) de todos os produtos
  - Exibir no dashboard como card destacado
  - Possível breakdown por categoria principal (Bebidas, Doces, etc)
  - Atualização em tempo real
  - Formato: R$ XX.XXX,XX

- [ ] **Controle de Acesso por Perfil de Usuário** (EM IMPLEMENTAÇÃO)
  - [x] Criar tela de Gerenciamento de Usuários (backend: listar, promover, rebaixar)
  - [x] Criar tela de Gerenciamento de Usuários (frontend)
  - [x] Implementar restrições de menu baseadas em role
  - [x] Ocultar campos sensíveis (custos) para usuários comuns
    - [x] Produtos: campo custo médio (formulário + tabela)
    - [x] Dashboard: card Valor Total em Estoque
  - [x] Criar página de Acesso Negado
  - [x] Adicionar verificações de autorização no backend
    - [x] Compras: todos os endpoints protegidos com adminProcedure
    - [x] Despesas: todos os endpoints protegidos com adminProcedure
    - [x] Contas a Pagar: todos os endpoints protegidos com adminProcedure
  - [ ] Testar com ambos os perfis (Admin e User)

**Observações:**
- Funcionalidades solicitadas pelo usuário para implementação antes da publicação em produção
- Prioridade: implementar após conclusão do inventário físico (atualmente 86.1% completo)
- Usuário quer dashboard e relatórios completos para admin, mas limitado para outros usuários

## 🔵 EM DESENVOLVIMENTO

- [ ] **Agrupamento temporal na Análise** - Adicionar opções de visualização por Dia, Semana e Mês
- [ ] **Destaque de feriados** - Marcar dias de feriado na análise diária (vendas sobem significativamente em feriados)
- [ ] **Filtros avançados** - Adicionar filtros por Produto específico e Subcategoria (ex: filtrar subcategoria Cerveja e depois marcas específicas)

## 🔴 BUGS CRÍTICOS - PENDENTES (0 itens)

## 🔴 BUGS CRÍTICOS - RESOLVIDOS

- [x] **Análise de Vendas não carregava dados** - Corrigido! Problemas identificados: (1) Usando `postingDate` ao invés de `saleDate` na tabela sales, (2) Usando `finalAmount` ao invés de `totalPrice` na tabela saleItems, (3) Período padrão em 2024 quando vendas estão em 2025. Todas as queries SQL corrigidas (getSalesAnalysisByValue, getSalesAnalysisByQuantity, getSalesAnalysisByCategoryValue) e página funcionando perfeitamente com dados de novembro/2025.

- [x] **Menu lateral do Consultor não mostrava todas as páginas** - Verificado e confirmado que já estava correto. Consultor tem acesso a Compras, Despesas, Contas a Pagar e Relatórios desde a implementação inicial do sistema de permissões.
- [x] **Operacional e Consultor podiam editar produtos** - Corrigido! Todos os campos do formulário de produtos (nome, categoria, subcategoria, EAN, unidade, estoque, custo, preços, produto composto, observações) agora ficam desabilitados (disabled) para usuários sem permissão canEdit.
- [x] **Operacional e Consultor podiam editar parceiros** - Corrigido! Todos os campos do formulário de parceiros (nome, nome fantasia, CPF/CNPJ, tipo, telefone, email, CEP, endereço, observações, limite de crédito, política de crédito) agora ficam desabilitados (disabled) para usuários sem permissão canEdit.

- [x] **Divergência de saldo em Contas a Receber** - Corrigido! Problema: venda #3270005 tinha pagamento a maior (R$ 11,00 em venda de R$ 4,50), criando saldo negativo (-R$ 6,50). Função getCustomerReceivableDetail() agora ignora saldos negativos. Ambas as telas mostram R$ 91,75 ✅

- [x] **Média diária calculada incorretamente** - Corrigido! Agora divide por dias CORRIDOS do mês usando timezone de Brasília. Mês passado: divide por total de dias do mês. Mês atual: divide por dia de hoje. Novembro: R$ 38.363,53 ÷ 30 = R$ 1.278,78 ✅ | Dezembro (dia 03): R$ 2.692,08 ÷ 3 = R$ 897,36 ✅
- [x] **Layout de vendas quebrado no mobile** - Resumo com grid responsivo (1 col mobile, 2 cols tablet, 4 cols desktop), layout adequado
- [x] **Espaçamento entre linha 1 e 2 no Dashboard desktop** - Gap 0 + padding cabeçalho py-1, espaço totalmente eliminado
- [x] **Quadros muito estreitos em mobile** - Scroll horizontal implementado (Dashboard: 600px, Relatórios: 650px), valores em uma linha
- [x] **Espaço grande entre primeira e segunda linha no calendário Dashboard** - Gap reduzido de 1 para 0.5, layout mais compacto
- [x] **Valores saindo dos quadros em mobile** - Dashboard: min-h aumentada para 85px, fonte reduzida para 10px, overflow-hidden + break-words
- [x] **Valores desenquadrados no calendário Relatórios** - Mobile: min-h 140px, fontes 9px, truncate. Desktop: gap reduzido, overflow controlado
- [x] **Remover título "Vendas dos Últimos 7 Dias" do Dashboard** - Título duplicado/desnecessário
- [x] **Remover botão "Ver Detalhes" duplicado no calendário do Dashboard** - Dois botões de detalhes no mesmo componente
- [x] **Aumentar tamanho dos quadros do calendário em mobile** - Gap aumentado, padding aumentado, fontes maiores (dia: 12px, valor: 10px)
- [x] **Ajustar tamanho dos quadros e fonte no calendário desktop** - Fontes aumentadas (dia: 14px, valor: 12px)
- [x] **Reduzir tamanho dos quadros em desktop** - Dashboard: 60px (dia: 16px, valor: 14px) | Relatórios: 100px (dia: 18px, valores: 12-14px)
- [x] **Aumentar altura dos quadros em mobile** - Dashboard: min-h 70px | Relatórios: min-h 110px + breakdown por canal visível

## 🟢 FUNCIONALIDADES IMPLEMENTADAS (Verificadas em 13/11/2025)

- [x] Edição de produto composto mostra composições corretamente
- [x] Custo automático de produtos compostos baseado nos componentes (função updateCompositeProductCost)
- [x] Venda de produto composto dá baixa automática nos componentes (função updateProductStockWithCompositions)
- [x] Cadastro rápido de fornecedor em Compras (implementado e funcional)
- [x] Histórico de pagamentos mostra compras E despesas (query getPaymentHistory)

## 🟡 MELHORIAS DE UX - Baixa Prioridade (3 itens)

- [ ] **Sistema de permissões para Consultor** - Menu lateral não mostra Compras, Despesas, Contas a Pagar e Relatórios para role "consultor". Investigar problema de cache/HMR. PRIORIDADE: Baixa (sistema não será aberto para novos usuários por enquanto)

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


## ✅ MELHORIAS CONCLUÍDAS (15/11/2025)

- [x] Definir "Pago na plataforma" como forma de pagamento padrão em vendas Delivery
  - **JUSTIFICATIVA:** Independente da forma de pagamento do cliente, o repasse é feito pela plataforma
  - **IMPLEMENTAÇÃO:** useEffect que define automaticamente "Pago na Plataforma" ao selecionar tipo DELIVERY
  - **IMPACTO:** Otimiza fluxo de trabalho, reduz campos a preencher
  - **TESTE:** Usuário pode alterar se necessário, mas padrão já vem preenchido

## 📊 FUNCIONALIDADE FUTURA - Regras de Comissão por Canal (ALTA PRIORIDADE)

- [ ] Implementar sistema de cálculo de comissões e taxas por canal de delivery
  - **OBJETIVO:** Calcular rentabilidade real considerando custos de cada plataforma
  - **CANAIS AFETADOS:** iFood, 99Food, Aiqfome
  - **EXEMPLO iFood:**
    - % de comissão sobre vendas (ex: 12% a 27% dependendo do plano)
    - % referente ao repasse (ex: taxa de processamento)
    - Valor fixo mensal (ex: R$ 130,00 de mensalidade)
  - **FUNCIONALIDADES NECESSÁRIAS:**
    - [ ] Cadastro de regras por canal (% comissão, % repasse, valor fixo)
    - [ ] Cálculo automático de custo por venda delivery
    - [ ] Relatório de rentabilidade real por canal
    - [ ] Dashboard com margem líquida (descontando comissões)
  - **IMPACTO:** Essencial para análise financeira precisa e decisões estratégicas
  - **PRIORIDADE:** Alta (após estabilização do sistema com dados reais)


## ✅ BUG CRÍTICO CORRIGIDO (15/11/2025)

- [x] Ícone de lixeira em composições fecha formulário sem salvar alteração
  - **DESCRIÇÃO:** Ao editar produto composto e clicar no ícone de lixeira para remover item da composição, o formulário fechava automaticamente
  - **IMPACTO:** Era impossível remover itens de composições existentes
  - **CAUSA:** Botão de lixeira sem type="button", sendo tratado como submit do formulário
  - **SOLUÇÃO:** Adicionado type="button" a todos os botões de exclusão em CompositionsSection e TempCompositionsSection
  - **TESTE:** Agora é possível remover itens de composições sem fechar o formulário


## ✅ TAREFAS CONCLUÍDAS (18/11/2025)

- [x] Excluir produto de teste "Água Mineral Teste 500ml" (ID: 2010005)
  - **RESULTADO:** Produto excluído com sucesso do banco de dados
- [x] Adicionar horário no campo "Data de Compra" em Contas a Receber
  - **JUSTIFICATIVA:** Importante mostrar hora exata da compra para o cliente
  - **LOCAL:** Tela de Contas a Receber, coluna "Data de Compra"
  - **FORMATO:** DD/MM/YYYY HH:MM
  - **IMPLEMENTAÇÃO:** Modificada função formatDate para usar toLocaleString com hour e minute


## 📋 PENDÊNCIAS PRIORITÁRIAS (19/11/2025)

### 🔴 Alta Prioridade - Operação

- [ ] **Completar inventário físico** (620 produtos restantes)
  - **STATUS:** 212 de 833 produtos com estoque atualizado (25%)
  - **MÉTODO:** Enviar arquivo Excel com coluna "Estoque Atual" preenchida
  - **SCRIPT:** Já existe e funciona perfeitamente (processar-inventario.py)
  - **PRAZO:** Até quinta-feira (21/11/2025)

- [ ] **Implementar sistema de cálculo de comissões por canal**
  - **JUSTIFICATIVA:** Necessário para análise de rentabilidade real por canal de venda
  - **EXEMPLO iFood:** % comissão sobre vendas + % repasse + valor fixo mensal (R$ 130,00)
  - **CANAIS:** iFood, 99Food, Aiqfome
  - **IMPACTO:** Permitirá relatório de lucro líquido por canal descontando taxas

### 🟡 Média Prioridade - Melhorias

- [ ] **Criar relatório de margem de lucro por produto**
  - **OBJETIVO:** Mostrar diferença entre custo e preço de venda por canal
  - **FUNCIONALIDADE:** Identificar produtos com margem baixa ou negativa
  - **USO:** Ajuste estratégico de preços e decisões de compra

- [ ] **Implementar alerta de estoque crítico no dashboard**
  - **OBJETIVO:** Notificação visual quando produtos atingirem estoque mínimo
  - **FUNCIONALIDADE:** Opção de gerar ordem de compra automática
  - **IMPACTO:** Evitar rupturas de estoque e perda de vendas

- [ ] **Corrigir layout mobile de vendas**
  - **PROBLEMA:** Resumo não tem layout responsivo adequado
  - **SOLUÇÃO:** Implementar grid responsivo com resumo lateral fixo em desktop

### 🔵 Baixa Prioridade - UX

- [ ] **Tooltips explicativos nos formulários**
  - **OBJETIVO:** Ajudar usuários novos a entender campos complexos

- [ ] **Confirmação antes de deletar registros**
  - **OBJETIVO:** Prevenir deleções acidentais

- [ ] **Filtro por subcategoria em Produtos**
  - **OBJETIVO:** Facilitar navegação no catálogo de 833 produtos

### 📊 Funcionalidades Futuras

- [ ] **Importar histórico de vendas 2022-2025**
  - **OBJETIVO:** Análises históricas e comparativos
  - **FORMATO:** Definir CSV/Excel com mapeamento de campos

- [ ] **Relatório de rentabilidade por canal**
  - **DEPENDÊNCIA:** Requer sistema de comissões implementado
  - **OBJETIVO:** Comparar lucro líquido entre canais (Balcão vs Delivery)

- [ ] **Card de ticket médio no dashboard**
  - **OBJETIVO:** Acompanhar valor médio por venda

- [ ] **Filtro de período customizado**
  - **OBJETIVO:** Análises por semana, quinzena, trimestre

- [ ] **Histórico de alterações (auditoria)**
  - **OBJETIVO:** Log de quem alterou o quê e quando
  - **FOCO:** Composições de produtos, preços, custos

## 🔧 CORREÇÕES SOLICITADAS (19/11/2025 - 01:30)

- [x] **Formatação do Valor Total em Estoque** - Adicionar separadores de milhar (R$ 129.247,05 ao invés de R$ 129247.05)
- [x] **Excluir produtos compostos do cálculo de estoque** - Produtos compostos (isComposite=true) não devem ser contabilizados no valor total, pois duplicariam o valor (componentes já estão no estoque)

## 🐛 BUG REPORTADO (19/11/2025 - 01:40)

- [x] **Campo de vencimento não aparece no dashboard** - Usuário cadastrou compra com vencimento 24/11, mas produto não aparece no card "Produtos Vencendo". RESOLVIDO: Função confirmPurchaseOrder agora transfere expiryDate de purchaseOrderItems para products.expirationDate automaticamente.

## 🎨 MELHORIAS UX SOLICITADAS (19/11/2025 - 01:50)

- [x] **Expansão de categorias no modal de estoque** - Ao clicar em uma categoria no modal "Valor em Estoque", expandir e mostrar lista de produtos individuais com seus valores (estoque × custo), ordenados do maior para o menor valor

## 🐛 BUG REPORTADO (19/11/2025 - 02:05)

- [x] **R$ 13,00 em contas a receber após exclusão de vendas teste** - Mesmo após excluir todas as vendas de teste, dashboard ainda mostra R$ 13,00 pendente de recebimento. RESOLVIDO: Registro órfão na tabela receivables foi identificado e removido.

## 🐛 BUG REPORTADO (20/11/2025 - 13:30)

- [x] **Divergência no faturamento do dashboard** - Usuário fez vendas que somam R$ 700+, mas dashboard mostra apenas R$ 505. RESOLVIDO: Dashboard buscava apenas 10 vendas recentes. Corrigido para buscar todas as vendas do mês (limit 10000).

## 🚀 NOVAS FUNCIONALIDADES SOLICITADAS (20/11/2025 - 13:30)

### Alta Prioridade

- [x] **Inventário completo com todas informações** - Exportar Excel com: ID, Nome, Categoria, EAN, Unidade, Estoque Atual, Estoque Mínimo, Custo Médio, Valor em Estoque, Vencimento. CONCLUÍDO: Arquivo gerado com 10 colunas. Preços por canal serão adicionados em versão futura.

- [x] **Detalhamento de vendas (Modal/Página)** - Ao clicar em uma venda, abrir modal ou página com detalhes completos:
  - Cabeçalho: Número da venda, data/hora, canal, cliente (se houver), status
  - Itens: Lista de produtos vendidos (nome, quantidade, preço unitário, subtotal)
  - Totais: Subtotal, descontos, acréscimos, total final
  - Pagamento: Forma de pagamento, valor pago, troco
  - Observações: Notas adicionais
  - Ações: Botão para imprimir/exportar comprovante (PDF ou impressão direta)
  - **Objetivo futuro:** Base para emissão de documentos fiscais (NFC-e, etc)

**Observações:**
- Inventário completo será base para atualizações futuras e auditoria de preços
- Detalhamento de vendas é preparação para futura emissão fiscal
- Usuário quer possibilidade de gerar comprovante de venda para o cliente

## ✅ BUGS RESOLVIDOS (20/11/2025 - 16:10)

- [x] **Detalhamento de vendas não funciona na tela de Vendas** - Modal de detalhes só abre no dashboard. Na tela de Vendas, ao clicar em uma venda, não abre o modal. RESOLVIDO: Modal SaleDetailsModal adicionado na tela de Vendas com mesma funcionalidade do dashboard.

- [x] **Coluna "Total" zerada no comprovante impresso** - No comprovante de impressão, a coluna "Total" dos itens aparece como R$ 0,00, embora o subtotal esteja correto. RESOLVIDO: Corrigido para usar sale.finalAmount.

**Melhorias Concluídas:**

- [x] **Melhorar cabeçalho do comprovante** - Alterar título de "ERP ADEGA BEIRA RIO" para apenas "Adega Beira Rio" e adicionar logo da adega no topo do comprovante. CONCLUÍDO: Logo adicionado em /client/public/logo.png e título atualizado.


## 🎨 MELHORIAS UX SOLICITADAS (20/11/2025 - 16:20)

- [x] **Ajustar layout do comprovante para bobina térmica 80mm** - Usuário quer imprimir comprovante em bobina padrão de máquina de cartão (80mm). CANCELADO: Revertido para layout A4 padrão. Otimização para térmica fica para o futuro.

- [x] **Corrigir logo do comprovante para usar logo da adega** - Logo atual estava usando logo do sistema (ABRWF). RESOLVIDO: Alterado para /logo-adega.png que é o logo correto da Adega Beira Rio.

- [x] **Corrigir formatação de valores no dashboard** - Valores de faturamento mensal e diário estavam sem separador de milhar (1127.00). RESOLVIDO: Criada função formatCurrency usando Intl.NumberFormat com locale pt-BR. Agora exibe 1.127,00 corretamente.

- [x] **Melhorar campo Canal na tela de vendas** - Campo "Canal" estava sempre vazio (mostra "-"). RESOLVIDO: Para vendas Delivery, agora exibe o código do pedido da plataforma (platformOrderId) quando informado, facilitando conferência e conciliação com relatórios das plataformas.

- [x] **Adicionar cards de resumo na tela de Vendas** - Exibir cards no topo da tela mostrando quantidade e valor total por tipo de venda (Balcão, Delivery, A Prazo). RESOLVIDO: Criado endpoint sales.stats no backend e 4 cards no frontend (Balcão, Delivery, A Prazo, Total Geral) com cores distintas e ícones.

- [x] **Criar script de migração de vendas a prazo** - Importar vendas a prazo históricas do cliente Alexandre Lima mantendo data original da venda e sem alterar estoque (vendas anteriores ao inventário). RESOLVIDO: Script migrate-sales.mjs criado. Migradas 4 vendas (R$ 136,00) com datas originais, recebíveis e parcelas criadas automaticamente.

## 🐛 BUGS REPORTADOS (20/11/2025 - 21:40)

- [x] **Saldo divergente do Alexandre Lima** - Tela inicial de Contas a Receber mostra R$ 136,00, mas ao clicar no cliente mostra R$ 209,00. RESOLVIDO: Script de migração rodou duas vezes e criou venda duplicada #2160005. Deletada venda duplicada e saldo corrigido para R$ 136,00.

- [x] **Cards de resumo na tela de Vendas sem filtro de período** - Cards mostram total histórico de TODAS as vendas. Ao migrar vendas antigas (Alexandre Lima 04/11-15/11), elas foram somadas. RESOLVIDO: Adicionado filtro de período (Hoje, 7 dias, Mês, Todos) acima dos cards. Padrão: Mês.

- [x] **Saldo residual em Contas a Pagar** - Existe um saldo de R$ 0,05 pendente em Contas a Pagar que ainda permanece. RESOLVIDO: Encontrada parcela residual em purchaseInstallments com valor < R$ 0,10 (erro de arredondamento). Deletada via SQL. Saldo agora R$ 0,00.

- [x] **Deletar compra de teste #420001 e corrigir produto** - Usuário fez compra de teste para demonstração e baixa no contas a pagar. RESOLVIDO: Compra deletada, custo médio corrigido (R$ 9,32 → R$ 11,39) e data de validade removida. Produto Baden Baden Ipa não aparece mais em "Produtos Vencendo".

## 📥 MIGRAÇÃO DE DADOS - 21/11/2025

- [x] Migrar vendas a prazo históricas de 2 clientes (Jhonatan Gaspar removido)
  - Arquivo: MigraçãoVendasa Prazo.csv (corrigido)
  - 11 vendas migradas (02/11 a 20/11/2025)
  - 11 recebíveis criados automaticamente (vencimento em 30 dias)
  - Total: R$ 252,00 em vendas a prazo
  - Clientes: Ericles Araujo (4 vendas, R$ 80,00), Jackson Vinicius (7 vendas, R$ 172,00)

## 🐛 CORREÇÕES - 21/11/2025

- [x] Corrigir página de Gerenciar Usuários para exibir menu lateral (DashboardLayout)

## 📊 RELATÓRIOS - 21/11/2025

- [x] Gerar arquivo de inventário completo (CSV) com todos os produtos cadastrados
  - 845 produtos exportados
  - 16.845 unidades em estoque
  - Valor total: R$ 127.160,24
  - 242 produtos abaixo do mínimo

## 🔧 CORREÇÕES DE VENDAS - 21/11/2025

- [x] Corrigir item incorreto na venda #3270005 (substituir por Fanta Uva 350ml)
  - Item anterior: Fanta Uva 2L (R$ 11,00)
  - Item corrigido: Fanta Uva 350ml (R$ 4,50)
  - Estoque Fanta Uva 2L: 20 unidades (+1 devolvido)
  - Estoque Fanta Uva 350ml: 18 unidades (-1 descontado)
  - Recebível atualizado: R$ 4,50 (PENDENTE)

## 🚀 FUNCIONALIDADES FUTURAS (Pós-Publicação)

### ⚠️ PRIORIDADE: Edição e Exclusão de Vendas (Admin)
**Motivo:** Necessário para corrigir erros operacionais e processar devoluções/desistências
- [ ] **Implementar edição completa de vendas**
  - [x] Backend: Criar endpoint para editar venda (adminProcedure)
    - Validar permissão de admin
    - Permitir editar itens (adicionar, remover, alterar quantidade)
    - Ajustar estoque automaticamente (devolver estoque antigo, descontar novo)
    - Recalcular valores totais da venda
    - Atualizar recebíveis se for venda a prazo
    - Registrar log de alterações (quem editou, quando, o que mudou)
  - [x] Frontend: Adicionar botão "Editar Venda" na página de Vendas
    - Visível apenas para administradores
    - Modal de edição com lista de itens editável
    - Permitir adicionar/remover produtos
    - Permitir alterar quantidades
    - Mostrar resumo de valores (antes/depois)
    - Confirmação antes de salvar alterações
  - [x] Validações e regras de negócio
    - [x] Não permitir editar vendas com mais de 24 horas
    - [x] Não permitir editar se recebível já foi pago
    - [x] Ajuste automático de estoque
  - [ ] Definir regras de precificação (custo vs preço de venda)
  - [ ] Implementar logs de auditoria detalhados
  - [ ] Testes completos de todos os cenários
- [ ] **Implementar exclusão de vendas**
  - Endpoint para excluir venda (devolução/desistência)
  - Devolver estoque automaticamente
  - Cancelar recebíveis associados
  - Registrar motivo da exclusão

**Observações importantes:**
- Definir se usa preço de venda ou custo médio ao adicionar itens
- Implementar histórico de alterações (auditoria)
- Considerar impacto em relatórios e métricas
- Testar cenários: troca de produto, alteração de quantidade, devolução parcial/total

## 🐛 BUGS - 21/11/2025

- [x] Corrigir cálculo de limite de crédito
  - Cliente: Vitor Hugo
  - Problema: Campo currentBalance desatualizado (R$ 100 ao invés de R$ 93,50)
  - Solução: Calcular saldo em tempo real somando recebíveis pendentes
  - Agora validação sempre usa dados atualizados do banco

## 🔧 AJUSTES - 22/11/2025

- [x] Inserir códigos de pedido em vendas delivery sem código
  - Venda #3450005 → Código: 7848 ✅
  - Venda #3450006 → Código: 5966 ✅
  - Venda #3660002 → Código: 5407 (anterior: 7566) ✅
- [x] Renomear coluna "Canal" para "Pedido" na tabela de vendas


## 🐛 BUGS - 23/11/2025

- [x] Corrigir filtro "Hoje" na tela de Vendas (mostrando 387 vendas ao invés de 1)
  - Problema: Servidor usando fuso horário diferente de Brasília (GMT-3)
  - Vendas de ontem à noite sendo contadas como "hoje"
  - **SOLUÇÃO:** Implementado parsing correto de datas em horário de Brasília (GMT-3)
  - Filtro agora compara ano/mês/dia corretamente no timezone correto
  - Exibição de datas no frontend também corrigida para mostrar horário de Brasília

- [x] Corrigir cálculo de crédito disponível no modal de venda a prazo
  - Cliente: Ericles Araujo
  - Limite: R$ 500,00
  - Saldo devedor real: R$ 87,00 (confirmado em Contas a Receber)
  - Disponível mostrado (incorreto): R$ 493,00
  - Disponível correto: R$ 413,00 (R$ 500 - R$ 87) ✅
  - **SOLUÇÃO:** Criado endpoint partners.getAvailableCredit que calcula saldo devedor em tempo real
  - Frontend agora busca crédito atualizado ao selecionar cliente ao invés de usar currentBalance desatualizado


## 🐛 BUGS - 24/11/2025

- [ ] Corrigir fuso horário no filtro de vendas "Hoje"
  - Problema: Servidor publicado usa UTC, deveria usar GMT-3 (Brasília)
  - Sintoma: Filtro "Hoje" mostra vendas de ontem (após 21h)
  - Exemplo: Às 14h do dia 24, mostra 10 vendas (incluindo vendas de 23/11 às 22h, 21h)
  - Solução: Ajustar queries de data para usar timezone correto


## 🐛 BUGS - 25/11/2025

- [x] Dashboard mostrando "Venda Diária" incorreta (R$ 338,20 quando deveria ser R$ 0,00)
  - Última venda: 24/11/2025 às 22:58 (ontem)
  - Tela de Vendas (filtro "Hoje"): 0 vendas ✅ CORRETO
  - Dashboard: R$ 338,20 ❌ INCORRETO
  - Dashboard usando lógica diferente da tela de Vendas para calcular "hoje"
  - **SOLUÇÃO:** Aplicada mesma correção de timezone no Dashboard
  - Agora Dashboard e tela de Vendas usam a mesma lógica de conversão para Brasília


## 🆕 NOVAS TAREFAS - Dezembro 2025

- [ ] **Implementar visualização de detalhes de lançamentos de compra**
  - Criar modal/página para visualizar todos os itens de uma nota de compra
  - Listar produtos com quantidade, custo unitário, custo total, data de validade
  - Permitir auditoria dos itens realmente lançados (vs dados de teste)
  - Acessível a partir da tela de Compras (clique em linha ou botão de detalhes)
  - Mostrar informações da nota: fornecedor, data, total, status

## ✅ FUNCIONALIDADES IMPLEMENTADAS - DEZEMBRO 2025

- [x] Visualizar detalhes de lançamentos de compra
  - **IMPLEMENTAÇÃO:** Modal que mostra todos os itens lançados em cada compra
  - **DADOS EXIBIDOS:** Produto, Quantidade, Custo Unitário, Custo Total, Validade
  - **FUNCIONALIDADE:** Botão "Detalhes" em cada linha da tabela de compras abre o modal
  - **TESTE:** Compra #780001 (Carrefour) mostra 26 itens com dados corretos
  - **RESULTADO:** Auditoria de lançamentos agora possível, usuário consegue verificar exatamente quais produtos foram lançados

- [x] Correção de timezone em getSalesStats()
  - **BUG:** Filtros de período (today, week, month) usavam saleDate (nulo) ao invés de createdAt
  - **SOLUÇÃO:** Convertida lógica para usar createdAt com timezone de Brasília (GMT-3)
  - **RESULTADO:** Dashboard e Tela de Vendas agora mostram valores consistentes (R$ 761,69 para Dezembro)


## 🔧 CORREÇÕES CONCLUÍDAS - DEZEMBRO 2025

- [x] Corrigir venda #11700003 - Substituir Rothmans Red Global por Rothmans Red Hand-Selected
  - Removido Rothmans Red Global, adicionado Rothmans Red Hand-Selected
  - Preco atualizado de R$ 7,50 para R$ 9,00 (preco de venda correto)
  - Estoque corrigido: Global +1, Hand-Selected -1
  - Total venda: R$ 11,00 (Gomels R$ 1,00 + Pop! R$ 1,00 + Rothmans Red Hand-Selected R$ 9,00)


## 🐛 BUGS REPORTADOS - DEZEMBRO 2025 (Créditos Renovados)

- [ ] Corrigir bug de parcelamento em Compras - Botão desapareceu e valor não preenche automático
- [ ] Corrigir bug de subcategoria em Produtos - Campo não está clicável/editável
- [ ] Finalizar lançamento de vendas de Josivan (30/11/2025) - 6 itens, R$ 44,00


## ✅ BUGS CORRIGIDOS - SPRINT 03/12/2025

- [x] **Botões de Parcelamento em Compras**
  - PROBLEMA: Botões "+ Adicionar Parcela" e "Dividir" não apareciam na interface
  - CAUSA: Variáveis incorretas na função Dividir (freight/taxes ao invés de freightCost/chargesCost)
  - SOLUÇÃO: Corrigidas variáveis na linha 639 do Compras.tsx
  - TESTE: Botões funcionando perfeitamente, distribuição automática de valores testada com sucesso
  - RESULTADO: Parcelamento de compras 100% operacional

- [x] **Importação de Vendas do Josivan**
  - DADOS: 6 vendas com total de R$ 44,00 em 30/11/2025
  - PROCESSO: Script Node.js criado para importação com validações
  - RESULTADO: Todas as vendas importadas corretamente, estoque atualizado
  - VERIFICAÇÃO: Vendas aparecem na interface com cliente, data e valores corretos


## ✅ BUG CORRIGIDO - Importação de Vendas do Josivan (03/12/2025)

- [x] **Problema:** Importação de vendas do Josivan criou duplicatas (6 vendas importadas 2 vezes)
  - Saldo divergente: R$ 192,00 ao invés de R$ 148,00
  - Vendas aparecendo como "hoje" ao invés de 30/11/2025
  
- [x] **Investigação:** 
  - Script de importação foi executado 2 vezes acidentalmente
  - 12 vendas no banco (6 corretas + 6 duplicadas)
  - Recebíveis já existiam para todas as vendas
  
- [x] **Solução implementada:**
  - Removidas 6 vendas duplicadas (IDs #12210001 a #12210006)
  - Estoque restaurado aos valores corretos
  - Saldo do Josivan corrigido para R$ 148,00
  - Total de vendas A Prazo corrigido para 11
  - Interface atualizada corretamente (10 vendas pendentes, R$ 148,00)
  
- [x] **Resultado final:**
  - ✓ Saldo do Josivan: R$ 148,00 (correto)
  - ✓ Vendas do Josivan: 10 (6 novas + 4 antigas)
  - ✓ Total Pendente de Recebimento: R$ 992,50
  - ✓ Estoque: Restaurado
  - ✓ Dados consistentes em todas as tabelas (sales, receivables, receivableInstallments)


## ✅ BUGS CORRIGIDOS - Vendas do Josivan (03/12/2025)

- [x] **Venda Diária incluindo vendas de 30/11** - RESOLVIDO
  - Problema: Dashboard usava `createdAt` (data de criação) ao invés de `saleDate` (data da venda)
  - Solução: Alterado cálculo de Venda Diária para usar `saleDate` em server/routers.ts (linhas 1054 e 1081)
  - Resultado: Venda Diária agora mostra R$ 0,00 (correto - sem vendas de 03/12)

- [x] **Campo Pagamento mostra A_PRAZO ao invés de A Prazo** - RESOLVIDO
  - Problema: Vendas importadas tinham paymentMethod = "A_PRAZO" (com underscore)
  - Solução: Aplicada função `formatPaymentMethod()` na tabela de vendas (client/src/pages/Vendas.tsx linha 488)
  - Resultado: Tabela agora mostra "A Prazo" (com espaço) corretamente


## ✅ BUG CORRIGIDO - Formulário de Cadastro de Produtos (03/12/2025)

- [x] **Campo Subcategoria preenchido automaticamente com valor da Categoria** - RESOLVIDO
  - Problema: Input de Categoria usava id="subcategory" e valor de subcategorySearch
  - Solução: Alterado para id="category" e categorySearch em client/src/pages/Produtos.tsx (linhas 835-843)
  - Resultado: Campo Subcategoria permanece vazio ao digitar na Categoria (correto!)


## ✅ BUG CORRIGIDO - Preenchimento de Parcelas em Compras (03/12/2025)

- [x] **Valor da parcela preenchido automaticamente quando há apenas 1 parcela** - RESOLVIDO
  - Problema: Campo de valor ficava vazio quando havia apenas 1 parcela
  - Solução: Adicionado useEffect para preencher automaticamente com valor total
  - Implementação: client/src/pages/Compras.tsx (linhas 70-78)
  - Resultado: Parcela preenchida automaticamente (testado com R$ 10.00)


---

## 📋 MELHORIAS SOLICITADAS - Sprint 03/12/2025 (Análise em andamento)

### TELA DE COMPRAS - Problemas de UX

- [x] **Filtro de fornecedor corrigido** - RESOLVIDO
  - Problema: Ao clicar, exibia TODOS os fornecedores; ao digitar não filtrava
  - Solução: Implementado filtro case-insensitive com busca por nome e CNPJ
  - Implementação: Command com shouldFilter=false + filtro manual em client/src/pages/Compras.tsx
  - Resultado: Filtro funciona perfeitamente - digitar Carrefour mostra apenas Carrefour Autonomistas e Carrefour Super Shopping

- [x] **Barra de busca de produtos reposicionada** - RESOLVIDO
  - Problema: Campo de busca ficava no topo, forçava scroll ao adicionar itens
  - Solução: Movida para abaixo da tabela de produtos com scroll interno (max-h-96)
  - Implementação: Reorganizado layout em client/src/pages/Compras.tsx (linhas 428-515)
  - Resultado: Barra de busca sempre visível, tabela com scroll interno, melhor UX

### TELA DE VENDAS - Filtros e Visualização

- [x] **Implementar filtro de período padrão (últimas 24h)** - CONCLUÍDO
  - Implementação: Padrão = últimas 24 horas (inicializado via useEffect)
  - Filtros: Data (range com campos De/Até) e Canal (Balcão/Delivery/A Prazo/Todos)
  - Funcionalidade: Filtros aplicados em tempo real, botão "Limpar Filtros" restaura padrão
  - Resultado: Tela limpa, performance melhorada, filtros funcionando perfeitamente

- [x] **Cards dinâmicos sincronizados com filtros de período** - CONCLUÍDO
  - Problema: Cards mostram todas as vendas (103 vendas, R$ 2.108,83), filtro só afeta tabela
  - Solução: Cards atualizam conforme filtro de data e canal aplicado
  - Backend: Modificado sales.stats para aceitar parâmetros (dateFrom, dateTo, channel)
  - Frontend: Filtros atuais enviados para query dos cards
  - Resultado: Experiência consistente, análises personalizadas funcionando perfeitamente
  - Teste: Filtro 24h (48 vendas, R$ 881,53) vs Todas (1.244 vendas, R$ 40.428,36) ✅

- [ ] **Simplificar interface removendo botões de período**
  - Remover botões: Hoje, 7 dias, Mês, Todos (redundantes com filtro De/Até)
  - Padrão inicial: Filtrar automaticamente para dia atual ao abrir tela
  - Manter: Filtros De/Até e Canal para consultas personalizadas
  - Impacto: Interface mais limpa, foco no dia atual, flexibilidade mantida

### ANÁLISE E RELATÓRIOS - Novas Funcionalidades

- [ ] **Calendário de Análise de Vendas**
  - Visualizar faturamento por dia em formato de calendário
  - Separar por canal: Balcão e Delivery
  - Permitir clicar no dia para ver detalhes das vendas
  - Objetivo: Facilitar análise de tendências diárias

- [ ] **Calendário de Análise de Contas a Pagar**
  - Visualizar valores de pagamentos previstos por dia
  - Destacar dias com vencimentos importantes
  - Integrar com calendário de vendas para análise comparativa
  - Objetivo: Melhor planejamento de fluxo de caixa

- [ ] **Relatório de Análise Mensal (tipo Excel)**
  - Faturamento mensal (total e por canal)
  - Quantidade de produtos vendidos por mês
  - Projeções baseadas em histórico
  - Objetivo: Suportar decisões estratégicas e projeções futuras
  - Nota: Será mais poderoso após importação do legado

---

## 🎯 PRIORIZAÇÃO RECOMENDADA

**P1 (Alta) - Corrigir Bugs:**
1. Filtro de fornecedor em Compras (funcionalidade quebrada)
2. Posicionamento da barra de busca de produtos

**P2 (Média) - Melhorar UX:**
3. Filtro de período em Vendas (últimas 24h como padrão)

**P3 (Média-Alta) - Novas Funcionalidades:**
4. Calendário de Análise de Vendas - EM ANDAMENTO
5. Calendário de Análise de Contas a Pagar
6. Relatório de Análise Mensal

- [x] **Corrigir filtros para usar saleDate ao invés de createdAt** - CONCLUÍDO (03/12/2025)
  - Problema 1: Tabela vazia porque filtros usavam createdAt (data de implantação)
  - Problema 2: Vendas implantadas (Josivan) apareciam em dezembro mas eram de novembro
  - Solução: Backend modificado para filtrar por saleDate em todos os filtros (customizado, today, week, month)
  - Frontend: Já estava correto, priorizava saleDate
  - Resultado: Vendas aparecem na data correta (saleDate), não na data de implantação (createdAt)
  - Teste: 6 vendas do Josivan (R$ 44,00) têm saleDate=30/11 e createdAt=03/12, aparecem em novembro ✅
  - Interface simplificada: Removidos botões de período, filtro padrão = hoje

- [ ] **Implementar confirmação antes de deletar registros** - ADIADO
  - Motivo: Sistema não possui função de exclusão física (boa prática para ERP)
  - Próximo passo: Implementar inativação (soft delete) com campo active: boolean
  - Módulos: Vendas, Compras, Produtos, Parceiros, Despesas, Categorias/Subcategorias
  - UX: Botão "Inativar" com modal de confirmação
  - Impacto: Manter histórico completo, auditoria, segurança

- [x] **Corrigir layout responsivo de Vendas no mobile** - CONCLUÍDO (03/12/2025)
  - Problema: Resumo não tinha layout responsivo adequado, tudo em scroll vertical único
  - Solução: Grid responsivo com md:grid-cols-[1fr,400px] para desktop, stack automático em mobile
  - Desktop (>768px): Grid 2 colunas - formulário scrollável à esquerda + resumo fixo à direita
  - Mobile (<768px): Stack vertical automático - formulário acima, resumo abaixo
  - Resultado: Melhor aproveitamento de espaço horizontal, resumo sempre visível em desktop ✅

- [x] **Calendário de Análise de Vendas** - CONCLUÍDO (03/12/2025)
  - Objetivo: Visualizar faturamento diário por canal em formato calendário
  - Backend: Endpoint sales.calendar implementado com agregação por dia e canal
  - Frontend: Página /relatorios com grid de calendário 7 colunas (dias da semana)
  - Visualização: Cores por canal (Balcão=azul, Delivery=roxo, A Prazo=laranja)
  - Informações por dia: Faturamento por canal + total do dia
  - Navegação: Botões ← → para mudar mês, destaque para dia atual (borda azul)
  - Resultado: Identificação visual de padrões, tendências, dias de maior movimento ✅
  - Teste: Dezembro 2025 (dias 1-2 com vendas), Novembro 2025 (30 dias com dados)

- [x] **Melhorias no Calendário de Vendas** - CONCLUÍDO (03/12/2025)
  - Problema 1: Calendário completo ocupava muito espaço no Dashboard
  - Problema 2: Layout mobile quebrado, difícil visualizar
  - Solução Dashboard: Card compacto "Vendas dos Últimos 7 Dias" com 7 colunas, totais por dia, botão "Ver Detalhes" → /relatorios
  - Solução Mobile: Gap reduzido (gap-1), padding menor (p-1), fonte menor (text-xs), detalhamento por canal oculto (hidden md:block)
  - Resultado: Visão rápida no Dashboard, versão completa acessível, mobile legível e compacto ✅
  - Teste: Dashboard mostra últimos 7 dias com totais, redirecionamento funciona, mobile mostra apenas dia + total

- [x] **Otimizar Dashboard e Calendário** - CONCLUÍDO (03/12/2025)
  - Dashboard: Removido card "Ações Rápidas" (menu lateral já é suficiente)
  - Dashboard: Calendário compacto expandido para largura completa
  - Dashboard: Vendas Recentes agora em largura completa abaixo do calendário
  - Calendário Completo: Adicionado total do mês abaixo do título (ex: "Total: R$ 2.338,33")
  - Calendário Completo: Total atualiza automaticamente ao navegar entre meses
  - Resultado: Melhor aproveitamento de espaço, informação mais completa, layout mais limpo ✅
  - Teste: Dezembro R$ 2.338,33 (3 dias), Novembro R$ 33.324,47 (30 dias) - atualização dinâmica funciona

- [ ] **Corrigir total de novembro e calendário do Dashboard**
  - Problema 1: Total de novembro mostra R$ 33.324,47 mas deveria ser R$ 38.363,53 (diferença de ~R$ 5.000)
  - Problema 2: Calendário do Dashboard mostra "últimos 7 dias" mas deveria mostrar mês atual completo
  - Solução 1: Investigar por que faltam vendas no cálculo do total (verificar filtros, agregação)
  - Solução 2: Substituir CompactSalesCalendar por calendário completo do mês com navegação
  - Formato: Grid completo (Dom-Sáb), dias com data (01/nov, 02/nov), total por dia
  - Impacto: Dados corretos, visão completa do mês no Dashboard

- [ ] **Compactar calendário do Dashboard e corrigir divergência**
  - Problema 1: Título "Vendas dos Últimos 7 Dias" incorreto (deveria ser "Faturamento por Dia")
  - Problema 2: Calendário muito largo, células com muito espaço
  - Problema 3: Divergência de R$ 793,40 entre calendário e tela de vendas (Novembro: R$ 37.570,13 vs R$ 38.363,53, Dezembro: R$ 3.253,73 vs R$ 2.460,33)
  - Solução Dashboard: Reduzir padding, gap, fonte para compactar
  - Solução Divergência: Investigar se há vendas sendo contadas em mês errado ou duplicadas
  - Impacto: Calendário mais compacto, totais corretos e consistentes


## 🆕 NOVAS FEATURES SOLICITADAS (03/12/2025)

### Alta Prioridade

- [x] **Faturamento Médio Diário na tela de Relatórios**
  - ✅ Adicionado abaixo do "Total: R$ X.XXX,XX" no calendário de Relatórios
  - ✅ Cálculo: Valor Total Faturado / Quantidade de Dias do Mês
  - ✅ Formato: "Média Diária: R$ XXX,XX" (azul)
  - ✅ Ajuda a visualizar performance média do mês

- [ ] **Possibilitar Alteração e Exclusão de Registros**
  - Vendas: permitir edição e exclusão (com validações de estoque)
  - Compras: permitir edição e exclusão (com recalculo de custo médio)
  - Despesas: permitir edição e exclusão
  - Parceiros: permitir exclusão (validar se tem vendas/compras associadas)
  - Adicionar confirmações antes de deletar
  - Implementar log de auditoria para rastreabilidade

- [ ] **Calendário de Contas a Pagar**
  - Similar ao calendário de vendas em Relatórios
  - Mostrar vencimentos de contas a pagar por dia
  - Breakdown por tipo (Compras, Despesas)
  - Indicadores visuais de vencido/a vencer
  - Total mensal e média diária

### Média Prioridade

- [ ] **Rotina de Backup Automático**
  - Backup diário do banco de dados
  - Retenção de backups (ex: últimos 30 dias)
  - Notificação de sucesso/falha
  - Opção de backup manual
  - Restauração de backup

- [x] **Auditoria e padronização de timezone** - Corrigido! Criado módulo `/shared/dateUtils.ts` com funções padronizadas. Corrigidos: Relatorios.tsx (calendário + média), Vendas.tsx (filtros), Compras.tsx (datas). Tudo usa America/Sao_Paulo. Documentação em TIMEZONE_FIX.md ✅

- [x] **Refatorar Contas a Receber para modelo de conta corrente** - Implementado! Nova tabela customerPayments, funções de cálculo de saldo (getCustomerBalance, getCustomersWithBalance, getCustomerAccountHistory, registerPaymentToBalance), router accountReceivable, página ContasReceberNovo.tsx (/contas-receber-novo). Sistema agora funciona como conta corrente real: pagamentos reduzem saldo geral, vendas A_PRAZO aumentam. Histórico cronológico com saldo acumulado. Testado: Vitor Hugo R$ 185,25 - pagamento R$ 50 = R$ 135,25 ✅

- [ ] **Divergência de saldo em Contas a Receber** - Lista mostra R$ 91,75 mas conta corrente mostra R$ 85,25 para cliente Vitor Hugo Fernandes. Diferença de R$ 6,50 indica cálculo inconsistente entre as duas telas.

## 🔄 REFATORAÇÃO EM ANDAMENTO - Contas a Receber como Conta Corrente

- [ ] **Refatorar sistema de Contas a Receber para funcionar como conta corrente real**
  - **Problema atual:** Pagamentos vinculados a vendas específicas, não reflete operação real
  - **Modelo correto:** Cliente tem saldo devedor geral (vendas A_PRAZO - pagamentos recebidos)
  - **Exemplo:** Cliente com R$ 200 de saldo paga R$ 20 (fica R$ 180), compra mais R$ 30 (fica R$ 210), paga R$ 10 (fica R$ 200)
  - **Mudanças:**
    - [ ] Remover vínculo obrigatório entre pagamento e venda
    - [ ] Calcular saldo como: Σ(vendas A_PRAZO) - Σ(pagamentos)
    - [ ] Tela Conta Corrente: histórico cronológico (vendas + pagamentos) com saldo acumulado
    - [ ] Simplificar registro de pagamento (apenas valor, data, método)
    - [ ] Atualizar lista de Contas a Receber com saldo calculado

## 🔧 MELHORIAS CONCLUÍDAS - Contas a Receber (Novo Modelo)

- [x] **Adicionar card de total a receber** - Implementado! Card no topo mostra R$ 1.263,50 total e 10 clientes com saldo devedor ✅

- [x] **Exibir saldo de crédito do cliente** - Implementado! Tela de histórico mostra 3 valores: Saldo Devedor (vermelho), Limite de Crédito (azul), Crédito Disponível (verde). Exemplo: Vitor Hugo R$ 134,75 devedor, R$ 101,50 limite, R$ 0,00 disponível (acima do limite) ✅

- [x] **Capturar horário real do pagamento** - Corrigido! Pagamentos de hoje usam getNowInBrazil() capturando horário real (ex: 07:12). Pagamentos de datas passadas usam meio-dia. Testado e funcionando ✅

## 🔧 TAREFAS CONCLUÍDAS

- [x] **Investigar divergência de saldo - Vitor Hugo** - Resolvido! Problema: R$ 100 em pagamentos antigos (receivablePayments) não migrados + R$ 60,50 em pagamentos de teste. Migrados 4 pagamentos antigos, removidos 3 de teste. Saldo corrigido: R$ 85,25 ✅

- [x] **Substituir rota antiga de Contas a Receber** - Concluído! Rota `/contas-receber` agora usa ContasReceberNovo.tsx (modelo conta corrente). Código antigo removido. Sistema funcionando perfeitamente ✅

## 🔧 MELHORIAS EM ANDAMENTO - Contas a Receber

- [ ] **Remover "X vendas pendentes" da lista** - Simplificar interface mostrando apenas nome do cliente e saldo devedor

- [ ] **Adicionar lançamento de débitos manuais** - Permitir adicionar valores avulsos à conta do cliente (ex: empréstimo em dinheiro, taxas, ajustes) sem vínculo a produtos/vendas

- [ ] **Validar limite de crédito em vendas A_PRAZO** - Bloquear ou alertar ao registrar venda quando cliente ultrapassar limite disponível

## ✅ FUNCIONALIDADE IMPLEMENTADA - Débitos Manuais (04/12/2025)

- [x] **Lançamento de débitos manuais em Contas a Receber**
  - **Objetivo:** Permitir lançar débitos que não são vendas (empréstimos, taxas, etc)
  - **Backend:** 
    - Criado endpoint `accountReceivable.registerDebit` (tRPC)
    - Função `registerDebitToBalance()` em server/db.ts
    - Nova tabela `customerDebits` para armazenar débitos manuais
    - Débitos aparecem no histórico com type='DEBIT'
  - **Frontend:**
    - Botão "Lançar Débito" ao lado de "Registrar Pagamento"
    - Modal com campos: Data, Valor, Descrição (obrigatória), Observações
    - Validações: valor > 0, descrição obrigatória
    - Débitos aparecem em vermelho no histórico (coluna Débito)
  - **Teste realizado:**
    - Cliente: Vitor Hugo Fernandes
    - Saldo anterior: R$ 85,25
    - Débito lançado: R$ 50,00 (Empréstimo em dinheiro)
    - Saldo atualizado: R$ 135,25 ✅
    - Crédito disponível: R$ 0,00 (limite R$ 101,50 - saldo R$ 135,25)
  - **Resultado:** Sistema funcionando perfeitamente! Débitos manuais integrados ao modelo de conta corrente ✅

## 🐛 PROBLEMAS REPORTADOS (04/12/2025 - 09:55)

- [x] **Modal de Vendas - Scroll duplo** - Scroll do resumo removido, apenas coluna esquerda (formulário) tem scroll. ✅

- [x] **Contas a Receber - Sem menu lateral** - DashboardLayout integrado em ambas as telas (lista e histórico). ✅

- [x] **Detalhes Contas a Receber - Falta visão de produtos por venda** - Tabela detalhada implementada com rowSpan para vendas. Cada produto tem linha própria mostrando: Data | Venda | Produto | Qtd | Valor Unit. | Total | Débito | Crédito | Saldo. Pagamentos e débitos ocupam linha única com colSpan. ✅

- [x] **Divergências de saldo em Contas a Receber**
  - Vitor Hugo Fernandes: corrigido para R$ 85,25 (débito de teste R$ 50,00 removido) ✅
  - Jackson Vinicius: R$ 266,00 confirmado matematicamente correto (soma de vendas sem pagamentos). Usuário deve verificar se há pagamentos não migrados do sistema antigo. ⚠️


## 🚀 NOVAS FUNCIONALIDADES - ALTERAÇÃO E EXCLUSÃO DE REGISTROS (04/12/2025)

### Regras Gerais
- **Todas as operações de alteração e exclusão são restritas a usuários ADMINISTRADORES**
- Implementar validações de permissão no backend (adminProcedure)
- Exibir botões de edição/exclusão apenas para admins no frontend

### Compras
- [x] **Alteração de Compras (Admin Only)** ✅
  - ✅ Backend: função `updatePurchaseOrderItems` recalcula estoque e custo médio
  - ✅ Frontend: botão "Editar" em compras confirmadas (admin only)
  - ✅ Permite editar: item, quantidade, valor unitário, data de vencimento, número do documento, tipo de documento
  - ✅ Parcelas em Contas a Pagar são atualizadas automaticamente

- [x] **Exclusão/Cancelamento de Compras (Admin Only)** ✅
  - ✅ Implementado cancelamento lógico (status CANCELLED)
  - ✅ Backend: função `cancelPurchaseOrder` reverte estoque e cancela parcelas pendentes
  - ✅ Frontend: botão "Cancelar" em compras confirmadas (admin only)
  - ✅ Validação: não permite cancelar se houver parcelas já pagas
  - ✅ Migração: adicionado status CANCELLED ao enum de purchaseInstallments

### Vendas
- [x] **Alteração de Vendas (Admin Only, 24h limit)** - Backend completo ✅
  - ✅ Função `updateSaleItems` com validação de 24h
  - ✅ Endpoint tRPC `sales.update` (adminProcedure)
  - ✅ Recalcula estoque, valores e atualiza receivables
  - [ ] Frontend: botões de editar e formulário

- [x] **Exclusão/Cancelamento de Vendas (Admin Only, 24h limit)** - Completo ✅
  - ✅ Função `cancelSale` com validação de 24h
  - ✅ Endpoint tRPC `sales.cancel` (adminProcedure)
  - ✅ Reverte estoque e marca receivable como quitado
  - ✅ Migração: adicionados campos status, cancelledAt, cancelledBy, cancellationReason
  - ✅ Frontend: botão "Cancelar" em SaleDetailsModal (admin only, 24h limit)
  - ✅ Dialog de confirmação com campo de motivo opcional
  - ✅ Validação de 24h no frontend

### Despesas
- [ ] **Alteração de Despesas (Admin Only)**
  - Permitir editar: descrição, categoria, fornecedor, valor, data, parcelas
  - Atualizar parcelas em Contas a Pagar se valores mudarem
  - Validar se há parcelas já pagas antes de permitir alteração

- [ ] **Exclusão/Cancelamento de Despesas (Admin Only)**
  - Decidir entre exclusão física ou cancelamento (status CANCELADA)
  - Cancelar parcelas pendentes em Contas a Pagar
  - Registrar log de auditoria

### Melhorias na Tela de Compras
- [ ] **Adicionar Cards de Resumo**
  - Definir quais cards exibir (total do mês, pendente pagamento, etc)
  - Implementar cálculos no backend
  - Criar layout responsivo

- [ ] **Adicionar Filtros**
  - Definir filtros necessários (data, fornecedor, status, etc)
  - Implementar filtros no backend
  - Criar UI de filtros no frontend


## 🐛 BUGS REPORTADOS - Edição de Compras (04/12/2025)

- [x] **Campo Observações não carregado ao editar compra** - Corrigido! Adicionado `setNotes(purchase.purchaseOrder.notes || "")` na função loadPurchaseForEdit ✅
- [x] **Formulário não retorna à lista após salvar edição** - Corrigido! Adicionado `setIsCreating(false)` e `setSelectedPurchaseId(null)` no onSuccess da updateMutation ✅


## 🐛 BUGS/MELHORIAS REPORTADOS - 04/12/2025 (Vendas)

- [x] **Modal de Vendas - Scroll de produtos inviável no mobile** - Removido scroll fixo da coluna esquerda (formulário). Agora usa scroll natural do DialogContent, melhorando usabilidade no mobile. ✅

- [x] **Vendas canceladas - Falta destaque visual** - Adicionado Badge "CANCELADO" em vermelho ao lado do título no SaleDetailsModal quando status = CANCELLED. ✅


## 🚨 BUGS CRÍTICOS - 04/12/2025

- [x] **Modal de Vendas - Botão "Finalizar Venda" não visível no mobile** - Corrigido! Alterado `overflow-hidden` para `overflow-y-auto` no DialogContent. ✅

- [x] **Vendas canceladas - Sem indicador visual na listagem** - Corrigido! Função `getSaleTypeBadge` agora adiciona sufixo "-CANCELADO" em Badge vermelho quando status = CANCELLED. ✅

- [x] **Vendas canceladas contam no faturamento** - Corrigido! Função `getSalesStats` agora filtra vendas com `ne(sales.status, "CANCELLED")`. ✅

- [x] **Produtos vencendo de compras canceladas aparecem no card** - Corrigido! Função `cancelPurchaseOrder` agora atualiza `expirationDate` do produto para a data de vencimento mais recente de compras CONFIRMED (ou null se não houver). ✅


## ✅ CONCLUÍDO - Edição de Vendas (04/12/2025)

- [x] **Frontend de Edição de Vendas (Admin Only, 24h limit)** ✅
  - ✅ Botão "Editar" no SaleDetailsModal (ao lado de "Cancelar")
  - ✅ Modo de edição inline na tabela de itens
  - ✅ Remover itens existentes (botão X, desabilitado se for único item)
  - ✅ Alterar quantidade de itens (input numérico)
  - ✅ Cálculo automático do total ao editar
  - ✅ Validação de limite de 24h (botão Editar só aparece se < 24h)
  - ✅ Botões "Salvar Alterações" e "Cancelar" no modo de edição
  - ✅ Atualiza saldo em Contas a Receber via backend (vendas a prazo)
  - ✅ Oculta botões de ação (Editar, Cancelar, Imprimir) durante edição


## 🚀 EM DESENVOLVIMENTO - Adicionar Itens na Edição (04/12/2025)

- [ ] **Permitir adicionar novos produtos ao editar venda**
  - Adicionar campo de busca com autocomplete (mesmo padrão de criação)
  - Permitir selecionar produto e adicionar à lista de itens
  - Manter cálculo automático de totais
  - Testar fluxo completo: adicionar + alterar + remover
- [x] Adicionar funcionalidade de adicionar novos itens ao editar vendas (autocomplete de produtos)

## 🚀 EM DESENVOLVIMENTO - Melhorias Modo de Edição de Vendas (04/12/2025)

- [ ] Adicionar campos de Desconto e Acréscimo editáveis no modo de edição de vendas
- [ ] Corrigir layout mobile do formulário de adição de produtos (autocomplete sobrepondo campo de quantidade)
- [ ] Melhorar z-index do autocomplete para não sobrepor outros elementos

- [x] Adicionar campos de Desconto e Acréscimo editáveis no modo de edição de vendas
- [x] Corrigir layout mobile do formulário de adição de produtos (autocomplete sobrepondo campo de quantidade)
- [x] Melhorar z-index do autocomplete para não sobrepor outros elementos

## 🐛 BUGS REPORTADOS - Edição de Vendas (04/12/2025)

- [ ] Corrigir preço no autocomplete de produtos - está mostrando custo médio (avgCost) ao invés do preço de venda do canal
- [ ] Melhorar layout mobile do formulário de adição de produtos - autocomplete ainda sobrepõe campo de quantidade

- [x] Corrigir preço no autocomplete de produtos - estava mostrando custo médio (avgCost) ao invés do preço de venda do canal
- [x] Melhorar layout mobile do formulário de adição de produtos - autocomplete ainda sobrepõe campo de quantidade

## 🎨 MELHORIAS DE UX - Padronização (04/12/2025)

- [ ] Padronizar layout de adição de produtos no modo de edição (usar mesmo padrão da venda nova: campo flex-1 + qtd w-20 + botão +)
- [ ] Padronizar autocomplete em vendas novas com formato "Estoque: X | Preço: R$ Y" (mesmo da edição)

- [x] Padronizar layout de adição de produtos no modo de edição (usar mesmo padrão da venda nova: campo flex-1 + qtd w-20 + botão +)
- [x] Padronizar autocomplete em vendas novas com formato "Estoque: X | Preço: R$ Y" (mesmo da edição)

## 🔒 CONTROLE DE ACESSO - Role Admin (04/12/2025)

- [ ] Adicionar validação de role admin nos procedures sales.update e sales.cancel (backend)
- [ ] Ocultar botões Editar e Cancelar no frontend para usuários não-admin (frontend)

- [x] Adicionar validação de role admin nos procedures sales.update e sales.cancel (backend) - JÁ IMPLEMENTADO com adminProcedure
- [x] Ocultar botões Editar e Cancelar no frontend para usuários não-admin (frontend) - JÁ IMPLEMENTADO com user?.role === "admin"

## 🐛 BUG - Vendas não aparecem na lista (04/12/2025)

- [ ] Investigar por que vendas não estão aparecendo na página de vendas

## 🐛 BUG - Dashboard incluindo vendas canceladas (04/12/2025)

- [ ] Corrigir query de stats do dashboard para excluir vendas com status CANCELLED

- [x] Corrigir query de stats do dashboard para excluir vendas com status CANCELLED

## 🔐 SISTEMA DE PERMISSÕES - 3 Roles (04/12/2025)

### Backend
- [ ] Atualizar schema do banco: adicionar roles OPERACIONAL e CONSULTOR ao enum
- [ ] Criar operationalProcedure middleware (acesso a vendas e produtos limitados)
- [ ] Criar consultorProcedure middleware (read-only em tudo)
- [ ] Ajustar dashboard.stats para filtrar vendas por usuário (operacional)
- [ ] Criar products.listForOperational (apenas campos permitidos)

### Frontend
- [ ] Ocultar menu lateral para operacional (apenas Vendas e Produtos)
- [ ] Limitar campos visíveis de produtos para operacional
- [ ] Desabilitar botões de criar/editar/excluir para consultor
- [ ] Filtrar dashboard por usuário (operacional)
- [ ] Adicionar indicador visual de role no header

- [x] Atualizar schema do banco: adicionar roles OPERACIONAL e CONSULTOR ao enum
- [x] Criar operationalProcedure middleware (acesso a vendas e produtos limitados)
- [x] Criar consultorProcedure middleware (read-only em tudo)
- [x] Ajustar dashboard.stats para filtrar vendas por usuário (operacional)
- [x] Criar products.listForOperational (apenas campos permitidos)
- [x] Ocultar menu lateral para operacional (apenas Vendas e Produtos)
- [x] Limitar campos visíveis de produtos para operacional
- [x] Adicionar indicador visual de role no header
- [x] Criar hook usePermissions para centralizar lógica de permissões

## 👥 CONCLUSÃO SISTEMA DE USUÁRIOS (04/12/2025)

### Backend
- [ ] Criar users.list procedure (apenas admin)
- [ ] Criar users.create procedure (apenas admin)
- [ ] Criar users.update procedure (apenas admin)
- [ ] Criar users.delete procedure (apenas admin)

### Frontend
- [ ] Implementar página Gerenciar Usuários com tabela e formulários
- [ ] Aplicar usePermissions em Produtos (desabilitar botões para consultor)
- [ ] Aplicar usePermissions em Vendas (desabilitar editar/cancelar para consultor)
- [ ] Aplicar usePermissions em Compras (ocultar página para operacional)
- [ ] Aplicar usePermissions em Despesas (ocultar página para operacional)
- [ ] Aplicar usePermissions em Parceiros (ocultar página para operacional)

### Testes
- [ ] Testar role ADMIN (acesso total)
- [ ] Testar role OPERACIONAL (vendas + produtos limitados)
- [ ] Testar role CONSULTOR (read-only)

- [x] Criar users.list procedure (apenas admin)
- [x] Criar users.create procedure (apenas admin)
- [x] Criar users.update procedure (apenas admin)
- [x] Criar users.delete procedure (apenas admin)
- [x] Implementar página Gerenciar Usuários com tabela e formulários

- [x] Aplicar usePermissions em Produtos (desabilitar botões para consultor)
- [x] Aplicar usePermissions em Vendas (desabilitar editar/cancelar para consultor)

- [x] Corrigir bug de upsertUser não salvar role corretamente
- [x] Testar criação de usuário Consultor
- [x] Validar badges de permissão (Admin, Operacional, Consultor)
- [x] Sistema de permissões completo e funcional

## 🔧 AJUSTES DE PERMISSÕES

- [ ] Adicionar Contas a Pagar, Despesas, Compras e Relatórios no menu do Consultor
- [ ] Desabilitar botões de criar/editar/excluir em Produtos para Operacional e Consultor
- [ ] Desabilitar botões de criar/editar/excluir em Parceiros para Operacional e Consultor
- [ ] Habilitar Registrar Pagamento (Contas a Receber) para Operacional
- [ ] Habilitar Lançar Débito (Contas a Receber) para Operacional

- [x] Adicionar Contas a Pagar, Despesas, Compras e Relatórios no menu do Consultor
- [x] Desabilitar botões de criar/editar/excluir em Produtos para Operacional e Consultor
- [x] Desabilitar botões de criar/editar/excluir em Parceiros para Operacional e Consultor
- [x] Habilitar Registrar Pagamento (Contas a Receber) para Operacional
- [x] Habilitar Lançar Débito (Contas a Receber) para Operacional
- [x] Adicionar Parceiros e Contas a Receber no menu do Operacional
