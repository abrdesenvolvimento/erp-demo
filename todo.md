# ABRWF - Pendências e Melhorias

**Última atualização:** 04/02/2026

---

## 📋 ESTRUTURA DA EQUIPE

| Membro | Papel | Responsabilidades |
|--------|-------|-------------------|
| **Gabriel** | Product Owner / Desenvolvedor | Idealizar melhorias, identificar problemas, definir prioridades e validar entregas |
| **ChatGPT** | Co-Desenvolvedor / Apoio Técnico | Aprofundar regras, esclarecer pontos técnicos, sugerir soluções e revisar código |
| **Aurora (Manus)** | Desenvolvedora Principal | Execução de código, implementação de funcionalidades e evolução técnica |

---

## 🔴 BUGS CRÍTICOS

### BUG-01: Vendas Delivery - Número do Pedido ✅ (03/02/2026)
- [x] Ao editar venda Delivery, agora traz o número do pedido lançado inicialmente
- [x] Ao editar, salva corretamente a alteração do número do pedido (patch semantics)
- [x] Número do pedido exibido no cabeçalho da venda (modo visualização)
- [x] Padronizado nome do campo como `platformOrderId` em todas as camadas

### BUG-02: Edição de Compras - Juros ✅ (03/02/2026)
- [x] Ao editar compra, frete/juros agora refletem corretamente no total
- [x] Parcelas em aberto são recalculadas após alteração de valores
- [x] Implementado patch semantics (não sobrescreve undefined)
- [x] Transação atômica implementada
- [x] Cálculos em centavos para evitar erros de arredondamento
- [x] Validação: bloqueia edição de valores se houver parcela paga

### BUG-03: Timezone ✅ Fase 1 (03/02/2026)
- [x] Adicionados helpers de intervalo ao dateUtils (startOfDay, endOfDay, startOfMonth, endOfMonth)
- [x] Migradas funções críticas de db.ts para usar dateUtils
- [x] Migradas funções críticas de routers.ts para usar dateUtils
- [x] Regra de ouro: "datas de negócio em SP via dateUtils; timestamps de sistema em UTC"
- [ ] Fase 2: Migrar exibição (PDF/backup) - pendente
- [ ] Fase 3: Manter timestamps técnicos em UTC - pendente

### BUG-05: Backup com Log ✅ (04/02/2026)
- [x] Migrado de OAuth2 para Service Account
- [x] Gabriel: Criou Service Account no Google Cloud Console
- [x] Gabriel: Compartilhou pasta de backup com Service Account
- [x] Gabriel: Atualizou GOOGLE_DRIVE_CREDENTIALS
- [x] Aurora: Atualizou código para usar GoogleAuth
- [x] Aurora: Criou tabela backupLogs para rastreabilidade
- [x] Aurora: Implementou endpoints /api/backup/history e /api/backup/last-success
- [x] **PIVOTADO:** Google Drive não funciona com Gmail pessoal + Service Account
- [x] **SOLUÇÃO:** Implementado upload para S3 (Manus Storage) como principal
- [x] Backup testado e funcionando com sucesso (S3)

### Backup Automático - Scheduler ✅ (04/02/2026)
- [x] Implementado node-cron para agendamento interno
- [x] Configurado execução diária às 3h (horário de Brasília)
- [x] Log de cada execução na tabela backupLogs (triggeredBy: 'scheduled')
- [x] Notificação automática em caso de falha
- [x] Endpoints: /api/scheduler/status e /api/scheduler/trigger
- [x] Testes criados e passando

### Sprint 1.5 - Documentação Multiempresa ✅ v1.1 (04/02/2026)
- [x] Documentar modelo de dados multiempresa (tabela `companies`)
- [x] Mapear impactos em 23 tabelas com companyId
- [x] Definir estratégia de migração em 6 fases (V1 + V2)
- [x] Estimar esforço: V1 (36-58h) + V2 (12-24h)
- [x] Documento: `/docs/ARQUITETURA-MULTIEMPRESA.md`
- [x] **v1.1:** categories/subcategories com companyId (estruturas diferentes por empresa)
- [x] **v1.1:** Nova tabela `branches` para filiais (1 empresa → N filiais)
- [x] **v1.1:** Faseamento V1 (companyId) + V2 (branchId)
- [x] **AGUARDANDO:** Estabilização de Competência, Fechamento e Contábil

---

## 🟡 MELHORIAS PRIORITÁRIAS

### Vendas A Prazo - Alterar Cliente
- [ ] Possibilitar alteração de cliente em venda a prazo já lançada
- [ ] Evitar necessidade de cancelar e criar nova venda

### Compras e Despesas - Trava de Edição
- [ ] Implementar prazo máximo de 3 dias para edição/cancelamento
- [ ] Importante devido à contabilização implementada

### Compras - Produto Duplicado ✅ (04/02/2026)
- [x] Produto já selecionado não aparece mais no autocomplete
- [x] Implementado com useMemo para performance
- [x] Funciona em criação e edição de compras

---

## 📊 MÓDULO CONTABILIDADE (NOVO)

### Estrutura do Módulo
- [ ] Criar menu específico de Contabilidade no ABRWF
- [ ] Plano de Contas Contábil
- [ ] Plano de Contas Gerencial
- [ ] Associação entre planos
- [ ] Contas Bancárias
- [ ] Relatórios oficiais:
  - [ ] Razão
  - [ ] Balanço
  - [ ] DRE (versão final consolidada)

### Outras Receitas (Novo Módulo)
- [ ] Registro de entradas não vinculadas a vendas de produtos
- [ ] Tipos: empréstimos bancários, bonificações, acordos, receitas extraordinárias
- [ ] Classificação gerencial e contábil correta

---

## 📱 IMPORTADOR IFOOD (NOVO MÓDULO)

### Objetivo
Automatizar importação de pedidos concluídos do iFood via arquivos JSON

### Escopo V1
- [ ] Importação de pedidos com status CONCLUDED
- [ ] Deduplicação por id_pedido_ifood
- [ ] Identificação de produtos por EAN
- [ ] De/Para para divergências de cadastro
- [ ] Bloqueio de importação em caso de divergência
- [ ] Aprovação manual de divergências
- [ ] Criação automática de vendas e itens
- [ ] Movimentação de estoque pelo fluxo padrão
- [ ] Histórico completo de importações
- [ ] Logs técnicos de cada execução
- [ ] Garantir idempotência (não duplicar importações)

### Arquivos de Entrada
- [ ] Pedidos.json (obrigatório)
- [ ] Itens Pedidos.json (obrigatório)
- [ ] Inventário Ifood.json (opcional, para De/Para)

### Interface
- [ ] Menu: Vendas → Importação iFood
- [ ] Upload dos arquivos JSON
- [ ] Prévia da importação
- [ ] Ações: importar, aprovar divergências, resolver De/Para
- [ ] Histórico de importações

---

## 📈 TELA DE FECHAMENTO (AJUSTES)

### Remover
- [ ] Despesas por Categoria (não utilizamos mais)
- [ ] DRE (mover para módulo Contabilidade)
- [ ] Coluna "Código" do quadro Despesas por Conta Gerencial

### Adicionar
- [ ] Quadro: Compras por Categoria de Produtos (similar ao Compras por Tipo)

### Manter
- [ ] Resumo Mensal Comparativo (como está)

### Impressão
- [ ] Adicionar logo da empresa no cabeçalho
- [ ] Ajustar layout para impressão A4

---

## 📊 ANÁLISES (MELHORIAS)

### Análise de Faturamento
- [ ] Calendário: destacar automaticamente feriados nacionais/regionais
- [ ] Permitir destaque manual de dias específicos (ex: loja fechada)
- [ ] Visão Mensal: adicionar coluna Faturamento Diário (Total / Dias Corridos)

### Análise por Canal
- [ ] Adicionar quantidade de vendas em cada card
- [ ] Adicionar ticket médio das vendas

### Análise de Vendas
- [ ] Filtro de datas específicas (feriados) para análise e previsão

---

## 🏢 ACESSO POR EMPRESA (FUTURO)

- [ ] Suporte a múltiplas empresas no ABRWF
- [ ] Isolamento de dados (produtos, vendas, financeiro, contabilidade)
- [ ] Isolamento em nível de banco e regras de acesso
- [ ] Evolução futura para ambientes com regras específicas por empresa

---

## 📜 HISTÓRICO E AUDITORIA

### Histórico de Preço
- [ ] Histórico de alterações de preço de venda e custo médio
- [ ] Registro automático: data, usuário, valor anterior/novo
- [ ] Auditoria de margem ao longo do tempo

### Histórico de Log (Auditoria)
- [ ] Criar tabela de logs no banco de dados
- [ ] Registrar alterações em: Produtos, Parceiros, Vendas, Compras
- [ ] Campos: usuário, data/hora, entidade, ação, valor anterior/novo
- [ ] Tela de consulta de logs com filtros

---

## 🔧 INFRAESTRUTURA

### Backup
- [ ] Revisar execução automática diária
- [ ] Corrigir upload para Google Drive (não funcional desde 15/01)
- [ ] Corrigir envio de e-mail de conclusão
- [ ] Implementar registro de falhas em log

### API WhatsApp
- [ ] Concluir integração para automações operacionais e comerciais
- [ ] Notificações, avisos, confirmações
- [ ] Integrar com eventos do ABRWF

---

## 📱 CATÁLOGO DIGITAL

- [ ] Definir escopo da integração ERP ↔ Catálogo
- [ ] Criar endpoint /api/catalogo no ERP
- [ ] Sincronizar produtos e preços do canal Balcão
- [ ] Adicionar indicador de disponibilidade (estoque)
- [ ] Avaliar necessidade de pedidos online

---

## 📚 DOCUMENTAÇÃO ("LIVRO")

### Documentação Operacional
- [ ] Visão institucional do sistema
- [ ] Módulos e funcionalidades
- [ ] Fluxos operacionais

### Documentação Técnica
- [ ] Arquitetura do sistema
- [ ] Stack tecnológico
- [ ] Referência técnica para desenvolvedores

---

## 🎨 INTERFACE E UX

### Dashboard
- [ ] Card de Controle de Crédito:
  - [ ] Limite total concedido
  - [ ] Valor utilizado
  - [ ] Saldo disponível
  - [ ] Percentual de utilização

### Metas
- [ ] Melhorias visuais/layout para reduzir aspecto "branco"
- [ ] Manter regras de negócio atuais

### Responsividade Mobile
- [ ] Melhorar responsividade em dispositivos móveis

---

## 🗑️ LIMPEZA DE DADOS

### Produtos Excluídos ✅ (03/02/2026)
- [x] IDs excluídos: 5280001, 5280002, 5310001, 5310002, 5310003, 4950001, 4950002, 4950003
- [ ] IDs mantidos (possuem movimentações reais): 4950004 (Nusakinho Alpino), 2070009 (Beck's 350ml)

### Parceiros Excluídos ✅ (03/02/2026)
- [x] IDs excluídos: 1410001, 1410002, 1410003, 1440001, 1440002, 1440003, 1530001 (Fornecedores/Clientes Teste)

---

## ✅ CONCLUÍDO

### 19/01/2026 - Contabilização Completa
- [x] Plano de contas gerenciais (50 contas)
- [x] Contabilização de despesas com código contábil
- [x] Perdas Estoque com baixa automática
- [x] Contabilização de receitas por canal
- [x] DRE completo na página de Fechamento
- [x] CMV calculado automaticamente

### 08/01/2026 - Sistema em Produção
- [x] Sistema completo publicado
- [x] Sistema de Metas mensais por canal
- [x] Fechamento Mensal com DRE
- [x] Controle de acesso por perfil
- [x] Backup automático diário

### Módulo Contábil v2.0 (Em Andamento)
- [x] Analisar estrutura contábil existente
- [x] Criar documentação técnica consolidada (`/docs/MODULO-CONTABIL.md`)
- [x] Definir arquitetura: journals, journalSources, accountingEntries, accountingPeriods
- [x] Definir Plano de Contas com 6 grupos (padrão brasileiro)

**Fase 1: Estrutura de Banco de Dados** ✅ (04/02/2026)
- [x] Atualizar schema chartOfAccounts (companyId, parentId, nature)
- [x] Criar tabela journals (lotes contábeis)
- [x] Criar tabela accountingEntries (lançamentos)
- [x] Criar tabela journalSources (rastreabilidade)
- [x] Criar tabela accountingPeriods (períodos contábeis)
- [x] Criar tabela otherRevenues (outras receitas)
- [x] Executar migração via SQL direto

**Fase 2: Popular Plano de Contas** ✅ (04/02/2026)
- [x] Script de seed com estrutura de 6 grupos (110 contas)
- [x] Popular contas analíticas essenciais (62 contas)
- [x] Criar período contábil 2026-02

**Fase 3: Backend - CRUD e Contabilização** ✅ (04/02/2026)
- [x] CRUD de contas contábeis (server/accounting.ts)
- [x] Funções de journals e lançamentos
- [x] Validações de partida dobrada
- [x] Funções de relatórios (Razão, Balancete, DRE)
- [x] Router tRPC (server/routers/accounting.ts)
- [x] Testes (11 testes passando)

**Fase 4: Frontend - Plano de Contas** ✅ (04/02/2026)
- [x] Visualização em árvore hierárquica
- [x] Formulário de criação/edição (modal)
- [x] Busca, Expandir/Colapsar
- [x] Estatísticas (total, analíticas, sintéticas)
- [x] Submenu Contabilidade na sidebar

**Fase 5: Relatórios** ✅ (04/02/2026)
- [x] Razão Contábil (extrato por conta com saldo corrente)
- [x] Balancete de Verificação (saldos de todas as contas)
- [x] DRE (Receitas - Custos - Despesas = Resultado)
- [x] Página /relatorios-contabeis com 3 abas
- [x] Filtros de período e conta
- [x] Menu Contabilidade → Relatórios Contábeis

**Fase 6: Outras Receitas** ✅ (04/02/2026)
- [x] CRUD completo (criar, editar, excluir)
- [x] Página /outras-receitas com filtro de competência
- [x] Cards de totais (Total, Confirmado, Pendente)
- [x] Integração com Plano de Contas (Conta de Receita, Conta de Banco)
- [x] Vinculação com Cliente/Parceiro (opcional)
- [x] Menu Contabilidade → Outras Receitas
- [ ] Integração com contabilização automática (journals) - próxima fase


### Correções Módulo Contábil (Feedback Gabriel - 04/02/2026)
- [x] Implementar módulo de Contas Gerenciais com amarração ao Plano Contábil
  - [x] Página /contas-gerenciais com listagem de 50 contas gerenciais
  - [x] CRUD completo (criar, editar contas gerenciais)
  - [x] Interface de mapeamento para Plano Contábil
  - [x] Filtros por natureza e classificação
  - [x] Badges de status (com/sem amarração)
  - [x] Menu Contabilidade → Contas Gerenciais
- [x] Corrigir botões Expandir/Colapsar na árvore do Plano de Contas
  - [x] Botão Expandir expande toda a árvore
  - [x] Botão Colapsar colapsa para níveis 1 e 2
  - [x] Clique no ícone de seta expande/colapsa individualmente
  - [x] Clique no código/nome da conta expande/colapsa
- [ ] Implementar seleção múltipla de contas nos relatórios contábeis

### Contabilização Automática (04/02/2026)
- [x] Corrigir formatação de moeda no DRE (valores não devem ser divididos por 100)
- [x] Gerar lançamentos contábeis para vendas (Balcão, A Prazo, Delivery) - apenas 2026+
- [x] Gerar lançamentos contábeis para despesas - apenas 2026+
- [x] Gerar lançamentos contábeis para compras - apenas 2026+
- [x] DRE completo funcionando com Receitas, Custos e Despesas
- [x] Corrigir divergências de valores (usar mesma lógica de timezone da Análise de Faturamento)
- [x] Distribuir despesas nas contas corretas (não mais todas em Aluguel)
- [ ] Verificar valor de CMV vs Compras no sistema (R$ 52.907 vs R$ 60.193)
- [ ] Implementar contabilização automática em tempo real (ao criar venda/despesa/compra)

### Melhorias Contas Gerenciais e Contas a Receber (04/02/2026)
- [x] Mover amarração contábil para dentro do modal de edição (unificar)
- [x] Criar contas gerenciais de Receita (8 contas criadas)
  - ROP001 - Receita de Vendas (Balcão)
  - ROP002 - Receita de Vendas (A Prazo)
  - ROP003 - Receita de Vendas (Delivery)
  - ROR001 - Receita de Aluguel
  - ROR002 - Receita de Serviços
  - ROR003 - Outras Receitas
  - RFI001 - Juros Recebidos
  - RFI002 - Descontos Obtidos
- [x] Melhorar Contas a Receber similar ao de Despesas:
  - [x] Campo de Conta Gerencial com autocomplete no modal Lançar Débito
  - [x] Seleção de Cliente com autocomplete na tela principal

### Melhorias Autocomplete e Outras Receitas (04/02/2026)
- [x] Adicionar autocomplete na seleção de Conta Contábil no modal de Contas Gerenciais
- [x] Melhorar módulo Outras Receitas:
  - [x] Adicionar seleção de Cliente com autocomplete
  - [x] Adicionar campo de Conta Gerencial de Receita com autocomplete (8 contas)
  - [x] Adicionar Conta de Banco com autocomplete
  - [x] Interface similar ao módulo de Despesas

### Padronização Formulários Outras Receitas e Despesas (04/02/2026)
- [x] Renomear "Colapsar" para "Recolher" no Plano de Contas
- [x] Padronizar formulário de Outras Receitas:
  - [x] Fornecedor (obrigatório, autocomplete)
  - [x] Data Emissão + Data Entrada + Competência (derivada automaticamente)
  - [x] Tipo Documento (Contrato, Fatura, NF, Cupom, Recibo, Boleto, Outros) + Nº Documento
  - [x] Conta Gerencial de Receita (autocomplete filtrado)
  - [x] Descrição (obrigatório)
  - [x] Data Crédito (quando a receita entrou em caixa)
  - [x] Forma de Recebimento (obrigatório)
  - [x] Observação (opcional)
  - [x] Valor + Status
- [x] Padronizar formulário de Despesas:
  - [x] Fornecedor (autocomplete)
  - [x] Data Emissão + Data Entrada + Competência (derivada automaticamente)
  - [x] Tipo Documento (Fatura, NF, Cupom, Contrato, Recibo, Boleto, Outros) + Nº Documento
  - [x] Conta Gerencial (filtrada por Despesa/Custo)
  - [x] Descrição (obrigatório)
  - [x] Data Vencimento (com parcelamento)
  - [x] Forma de Pagamento (Crédito G, Crédito R, Crédito ABR, Boleto, A Vista, Débito Automático)
  - [x] Observação (opcional)
  - [x] Valor (com divisão automática por vencimento)
- [x] Regra de competência: Data entrada pode ser último dia do mês anterior se lançado até dia 5
  - [x] Mensagem informativa exibida nos dois formulários

### Migração de Dados Existentes (04/02/2026)
- [x] Analisar dados existentes de Outras Receitas (0 registros)
- [x] Analisar dados existentes de Despesas (20+ registros)
- [x] Migrar Despesas: preencher issueDate, entryDate, competenceMonth
  - [x] issueDate = createdAt (data de emissão)
  - [x] entryDate = createdAt (data de entrada)
  - [x] competenceMonth = mês/ano derivado (ex: "2025-12", "2026-01")
- [x] Verificar visualização dos dados migrados nas telas
- [x] Ajustar filtros de data para mostrar todas as despesas por padrão

### Correção Relatórios Contábeis (04/02/2026)
- [ ] Receitas não estão considerando Vendas (Balcão, A Prazo, Delivery)
- [ ] Compras e Despesas não aparecem nos relatórios
- [ ] Implementar contabilização automática de Vendas por canal
- [ ] Implementar contabilização automática de Compras
- [ ] Implementar contabilização automática de Despesas
- [ ] Testar DRE, Balancete e Razão com dados reais

### Correções Contabilização (04/02/2026 - Feedback Gabriel)
- [ ] Limitar contabilização a partir de 2026 (remover 2022-2025)
- [ ] Corrigir divergência Balcão Jan/2026: Sistema R$ 56.493,25 vs DRE R$ 59.978,75
- [ ] Corrigir divergência A Prazo Jan/2026: Sistema R$ 7.115,40 vs DRE R$ 7.270,40
- [ ] Corrigir divergência Delivery Jan/2026: Sistema R$ 23.522,32 vs DRE R$ 23.281,66
- [ ] Corrigir divergência Custo Jan/2026: Sistema R$ 60.193,90 vs DRE R$ 52.907,03
- [ ] Corrigir mapeamento de despesas (todas indo para Aluguel 6.1.1.01)
- [ ] Investigar possível duplicação de lançamentos

