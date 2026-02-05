# ABRWF - Pendências e Melhorias

**Última atualização:** 05/02/2026

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

## 📊 MÓDULO CONTABILIDADE ✅ (05/02/2026)

### Estrutura do Módulo ✅
- [x] Menu específico de Contabilidade no ABRWF
- [x] Plano de Contas Contábil (110 contas em 6 grupos)
- [x] Plano de Contas Gerencial (58 contas)
- [x] Associação entre planos (amarração contábil)
- [x] Contas Bancárias
- [x] Relatórios oficiais:
  - [x] Razão (extrato por conta com saldo corrente)
  - [x] Balancete (saldos de todas as contas)
  - [x] DRE (Receitas - Custos - Despesas = Resultado)

### Outras Receitas ✅ (04/02/2026)
- [x] Registro de entradas não vinculadas a vendas de produtos
- [x] Tipos: empréstimos bancários, bonificações, acordos, receitas extraordinárias
- [x] Classificação gerencial e contábil correta
- [x] CRUD completo com formulário padronizado
- [ ] Integração com contabilização automática (journals) - próxima fase

### Contabilização Automática ✅ (05/02/2026)
- [x] Estrutura de lançamentos (createAccountingEntries, postJournal, addJournalSource)
- [x] Compras: D-Estoque / C-Fornecedores (confirmação) + D-Fornecedores / C-Caixa (pagamento)
- [x] Despesas: D-Conta Gerencial / C-Contas a Pagar (criação) + D-Contas a Pagar / C-Caixa (pagamento)
- [x] Vendas: D-Caixa ou Clientes / C-Receita de Vendas + D-CMV / C-Estoque
- [x] Recebimentos: D-Caixa / C-Clientes
- [x] Juros e Descontos integrados nos pagamentos
- [x] Retroação Janeiro/Fevereiro 2026 executada (83 compras, 2.723 vendas, 49 recebimentos)

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

### Backup ✅ (04/02/2026)
- [x] Execução automática diária às 3h (node-cron)
- [x] Upload para S3 (Manus Storage)
- [x] Registro em tabela backupLogs
- [x] Notificação em caso de falha
- [ ] Implementar retenção automática (manter últimos 30 dias)

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

## ✅ CONCLUÍDO (05/02/2026)

### Contabilização Automática Completa ✅
- [x] Estrutura de lançamentos (createAccountingEntries, postJournal, addJournalSource)
- [x] Contabilização de Compras (confirmação e pagamento)
- [x] Contabilização de Despesas (criação e pagamento)
- [x] Contabilização de Vendas (Balcão, Delivery, A Prazo) com CMV
- [x] Contabilização de Recebimentos de Clientes
- [x] Juros e Descontos integrados nos pagamentos
- [x] Retroação Janeiro/Fevereiro 2026 (83 compras, 2.723 vendas, 49 recebimentos)
- [x] Balancete e Razão verificados e funcionando

### Baixa Automática e Juros ✅
- [x] Baixa automática para Compras À Vista
- [x] Baixa automática para Despesas À Vista
- [x] Campos de Juros e Desconto nas parcelas (purchaseInstallments, expenseInstallments)
- [x] Modal de pagamento com campos separados para Juros (+) e Desconto (-)
- [x] Cálculo do total efetivo (base + juros - desconto)

### Módulo Contábil v2.0 ✅
- [x] Plano de Contas Contábil (110 contas em 6 grupos)
- [x] Plano de Contas Gerencial (58 contas)
- [x] Amarração entre planos
- [x] Relatórios: Razão, Balancete, DRE
- [x] Outras Receitas (CRUD completo)
- [x] Contas Gerenciais (CRUD completo)

### Correções e Melhorias ✅
- [x] Fornecedor obrigatório em Despesas
- [x] Cards de resumo movidos para cima do título
- [x] Formatação de moeda corrigida (separador de milhar)
- [x] Balancete revisado (soma apenas contas analíticas)
- [x] Razão com autocomplete e seleção múltipla de contas

---

## 🚀 SUGESTÕES DE PRÓXIMOS PASSOS (Aurora)

### 1. Relatório de Juros e Descontos
- [ ] Criar relatório que mostre total de juros pagos por período
- [ ] Mostrar total de descontos obtidos por período
- [ ] Comparativo mensal de despesas financeiras
- [ ] Identificar fornecedores com maior incidência de juros
- [ ] Facilitar análise financeira e tomada de decisão

### 2. Alertas de Vencimento
- [ ] Implementar notificações automáticas para parcelas próximas do vencimento
- [ ] Configurar antecedência do alerta (ex: 3 dias, 7 dias)
- [ ] Enviar alertas via WhatsApp (integração existente)
- [ ] Dashboard com parcelas vencendo nos próximos dias
- [ ] Ajudar a evitar pagamento de juros por atraso

### 3. Conciliação Bancária
- [ ] Desenvolver funcionalidade para importar extratos bancários (OFX/CSV)
- [ ] Conciliar automaticamente com lançamentos do sistema
- [ ] Identificar lançamentos não conciliados
- [ ] Gerar relatório de conciliação
- [ ] Integrar com contabilização automática

---

## 📅 HISTÓRICO DE SESSÕES

### 05/02/2026
- Implementada contabilização automática completa
- Retroação de Janeiro/Fevereiro 2026 executada
- Baixa automática para compras e despesas À Vista
- Campos de juros e desconto no pagamento

### 04/02/2026
- Módulo Contábil v2.0 completo
- Backup automático com S3
- Correções em Despesas, Outras Receitas e Relatórios

### 03/02/2026
- Correções de bugs críticos (Delivery, Compras, Timezone)
- Limpeza de dados de teste
- Documentação multiempresa


---

## 🔒 GOVERNANÇA CONTÁBIL (Novo - 05/02/2026)

### 1. Travas de Edição e Exclusão

#### 1.1 Compras e Despesas
- [x] Edição/exclusão permitidas até 3 dias após data de entrada (configurável)
- [x] Após prazo: bloquear edição e exclusão (canEditEntity)
- [x] Se competência FECHADA → bloqueio imediato
- [x] Se journal POSTED → bloqueio imediato
- [ ] Correções somente via estorno ou lançamento de ajuste

#### 1.2 Vendas
- [x] Edição/exclusão permitidas até 72 horas após a venda (configurável)
- [x] Após 72h: bloquear edição e exclusão
- [x] Se journal POSTED → bloqueio absoluto
- [x] Se competência FECHADA → bloqueio absoluto
- [ ] Correções via estorno + novo lançamento

### 2. Troca de Cliente em Venda
- [ ] Venda não contabilizada: permitir troca com log
- [ ] Venda contabilizada (journal POSTED): apenas via estorno + nova venda
- [ ] Competência fechada: bloquear em qualquer cenário

### 3. Motor de Contabilização em Lote

#### 3.1 Execução Automática (Semanal)
- [x] Configuração de dia/hora da execução (autoAccountingDay/Hour)
- [ ] Executar 1x por semana (Domingo → Segunda, 03:00) - implementar scheduler
- [ ] Agrupar journals por período semanal

#### 3.2 Execução Manual ("Contabilizar Agora")
- [x] Botão "Contabilizar Agora" na interface (GovernancaContabil.tsx)
- [x] Seleção de competência específica
- [x] Disponível apenas para admin
- [ ] Implementar execução do batch (runAccountingBatch)

#### 3.3 Regras do Motor
- [x] Idempotência: UNIQUE em journalSources (companyId, sourceType, sourceId)
- [x] Controle secundário: isAccounted + accountedJournalId
- [x] Nunca contabilizar competência FECHADA
- [x] Log completo (accountingBatchLog + governanceAuditLog)
- [ ] Transação atômica (tudo ou nada)
- [ ] Criar journal como DRAFT → validar → POSTED
- [ ] Notificação de falha

### 4. Parametrização por Empresa
- [x] salesEditWindowHours = 72 (default) - configurável
- [x] expensesEditWindowDays = 3 (default) - configurável
- [x] purchasesEditWindowDays = 3 (default) - configurável
- [x] allowRetroactivePosting = true (default) - configurável
- [x] retroactiveLimitDay = 5 (default) - configurável
- [x] Somente admin pode alterar
- [x] Log de alterações obrigatório (governanceAuditLog)

### 5. Regras Imutáveis (não parametrizáveis)
- [ ] Competência fechada nunca pode ser editada/violada
- [ ] Journals POSTED e accountingEntries são imutáveis
- [ ] Correção sempre via estorno/ajuste

### 6. Abertura de Períodos ✅
- [x] Funcionalidade de reabertura implementada (reopenAccountingPeriod)
- [x] Apenas para admin com justificativa obrigatória (mínimo 20 caracteres)
- [x] Log completo de quem abriu, quando e por quê (governanceAuditLog)
- [x] Prazo máximo de reabertura: 30 dias após fechamento (configurável)
- [x] Máximo de 2 reaberturas por período (configurável)
- [x] Janela de reabertura de 48h (fecha automaticamente)
- [ ] Notificar owner quando período for reaberto


---

## 👥 REVISÃO DE PERFIS E FUNÇÕES (Futuro - Pós Governança Contábil)

### Contexto
Com a implementação de governança contábil (travas, contabilização, abertura de períodos), o perfil "Admin" atual concentra muitas responsabilidades. Precisamos pensar em uma estrutura mais granular.

### Perfis Atuais
- Consultor (somente leitura)
- Vendedor (vendas e consultas)
- Admin (acesso total)

### Proposta de Revisão
- [ ] Avaliar criação de novos perfis ou funções específicas
- [ ] Possíveis funções a considerar:
  - Financeiro (Contas a Pagar/Receber, Despesas, Outras Receitas)
  - Contabilidade (Plano de Contas, Relatórios, Fechamento, Abertura de Períodos)
  - Compras (Pedidos de Compra, Fornecedores)
  - Estoque (Movimentações, Inventário, Perdas)
  - Gerente (Análises, Metas, Fechamento sem contabilidade)
- [ ] Definir matriz de permissões por função
- [ ] Avaliar se perfil ou função (ou ambos)
- [ ] Implementar controle granular de acesso
- [ ] Manter log de alterações de perfil/função

### Observação
Não liberar acesso Admin para todos os usuários. Funções específicas permitem delegar responsabilidades sem expor configurações críticas do sistema.
