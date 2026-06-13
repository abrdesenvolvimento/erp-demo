# ABRWF - Pendências e Melhorias

**Última atualização:** 02/03/2026

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
- [x] Fase 2: Migrar exibição (PDF/backup) — concluído 25/02
- [x] Fase 3: Manter timestamps técnicos em UTC — concluído 25/02

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

### Vendas A Prazo - Alterar Cliente ✅ (05/02/2026)
- [x] Possibilitar alteração de cliente em venda a prazo já lançada
- [x] Evitar necessidade de cancelar e criar nova venda
- [x] Atualização automática do Contas a Receber

### Compras e Despesas - Trava de Edição ✅ (05/02/2026)
- [x] Implementar prazo máximo de 3 dias para edição/cancelamento
- [x] Importante devido à contabilização implementada
- [x] Configurável via Governança Contábil

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

### Outras Receitas ✅ (05/02/2026)
- [x] Registro de entradas não vinculadas a vendas de produtos
- [x] Tipos: empréstimos bancários, bonificações, acordos, receitas extraordinárias
- [x] Classificação gerencial e contábil correta
- [x] CRUD completo com formulário padronizado
- [x] Integração com contabilização automática (journals)
- [x] Lançamento: D-Caixa / C-Conta Gerencial de Receita

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

### Escopo V1 ✅ CONCLUÍDO (06/02/2026)
- [x] Importação de pedidos com status CONCLUDED
- [x] Deduplicação por id_pedido_ifood
- [x] Identificação de produtos por EAN
- [x] De/Para para divergências de cadastro
- [x] Bloqueio de importação em caso de divergência
- [x] Aprovação manual de divergências
- [x] Criação automática de vendas e itens
- [x] Movimentação de estoque pelo fluxo padrão
- [x] Histórico completo de importações
- [x] Logs técnicos de cada execução
- [x] Garantir idempotência (não duplicar importações)
- [x] Exclusão de importações com reversão automática

### Arquivos de Entrada
- [x] Pedidos.json (obrigatório)
- [x] Itens Pedidos.json (obrigatório)
- [ ] Inventário Ifood.json (opcional, para De/Para)

### Interface
- [x] Menu: Vendas → Importação iFood
- [x] Upload dos arquivos JSON
- [x] Prévia da importação
- [x] Ações: importar, aprovar divergências, resolver De/Para
- [x] Histórico de importações

### Reescrita Completa (05/02/2026) - Seguindo Documentação Orion
- [x] Reescrever backend com lógica correta de mapeamento (De/Para via EAN/SKU)
- [x] Implementar validação de preços com tolerância
- [x] Implementar status: OK, PRODUCT_NOT_FOUND, PRICE_DIVERGENCE, BLOCKED, IMPORTED
- [x] Reescrever frontend seguindo wireframe do Gabriel
- [x] Cards: Total Pedidos, Aprovados, Não Localizado, Divergência Valor
- [x] Tabela: Seleção, Código, Data, Itens, Total, Status, Ação
- [x] Botões: Importar (individual), Verificar De/Para, Verificar Valor
- [x] Botão Atualizar Importação (reprocessa sem reimportar)
- [x] Botão Importar Seleção (lote)
- [x] Modal De/Para: vincular produto existente ou criar novo
- [x] Modal Verificar Valor: comparação detalhada de preços (funcionalidade OK, layout pendente)
- [x] Testar fluxo completo com arquivos de teste

### Correções Adicionais (05/02/2026)
- [x] Coluna Pedido: usar campo codigo_do_pedido_no_ifood
- [x] Modal Divergência de Valor: mostrar detalhes e opção de corrigir preço do canal
- [x] Garantir que pedidos cancelados NÃO aparecem na lista (CANCELLED/DECLINED filtrados em ifoodImport.ts)
- [x] Campo Data: usar campo inicio_da_entrega (ifoodImport.ts linha 370)
- [x] Corrigir erro de insert no ifoodImportLogs (parâmetros incorretos)

### Correções Recomendadas por Orion (05/02/2026)
- [x] Verificar estrutura da tabela ifoodImportLogs com SHOW CREATE TABLE
- [x] Corrigir INSERT no ifoodImportLogs com valores explícitos (importedAt, createdAt, errorMessage=null)
- [x] Corrigir forma de obter insertId do Drizzle/MySQL
- [x] Adicionar logs de erro completos (code/sqlMessage/errno)
- [x] Corrigir modal de divergência de valor (aumentar largura para max-w-4xl)

### Correções Adicionais (06/02/2026)
- [x] Usar codigo_do_pedido_no_ifood em vez de id_pedido_ifood no número do pedido (platformOrderId)
- [x] Implementar funcionalidade de exclusão de importações duplicadas
- [x] Modal de confirmação de exclusão com detalhes (quantidade de vendas a reverter)
- [x] Reversão automática de vendas, itens e movimentações de estoque
- [x] Atualização de preço do canal funcionando corretamente
- [x] Modal de divergência de valor otimizado (15/02/2026)

---

## 💰 CONTAS A PAGAR - INTEGRAÇÃO COM DESPESAS ✅ (07/02/2026)

### Objetivo
Integrar o módulo de Despesas com o módulo Contas a Pagar, garantindo que despesas apareçam automaticamente no Contas a Pagar assim como as compras.

### Implementação ✅
- [x] Adicionada coluna `expenseId` na tabela `accountsPayable`
- [x] Criada função `createAccountPayable` no db.ts
- [x] Criada função `getAccountsPayableByExpenseId` no db.ts
- [x] Integração implementada no routers.ts (criação de parcelas de despesas)
- [x] Função `getSupplierPayableDetail` já busca parcelas de despesas e compras
- [x] Testado manualmente: despesa criada → registros aparecem no Contas a Pagar

### Resultado
Quando uma despesa é criada com parcelas, o sistema automaticamente:
1. Cria os registros na tabela `expenseInstallments`
2. Cria os registros correspondentes na tabela `accountsPayable` com `expenseId` preenchido
3. Os registros aparecem na listagem do Contas a Pagar junto com as compras

### Observação
Despesas criadas ANTES desta implementação (07/02/2026) não possuem registros no Contas a Pagar. Apenas novas despesas terão a integração automática.

---

## 📈 TELA DE FECHAMENTO - NOVO LAYOUT (22/02/2026)

### Estrutura Aba Mensal
- [x] 1. Cards de Resumo (Faturamento, Lucro Bruto, Despesas, Outras Receitas, Resultado Líquido) + Comparativo Mês Anterior
- [x] 2. Vendas por Canal (Qtd, Faturamento, %, Ticket Médio) + Metas (Meta, Realizado, % Atingido)
- [x] 3. Vendas por Categoria (Faturamento, %, Margem) + Compras por Categoria (Valor, %) lado a lado
- [x] 4. Faturamento por Tipo de Pagamento (Tipo, Qtd Transações, Faturamento, %)
- [x] 5. Estoque por Categoria (Inicial, Final, Variação) + Giro de Estoque (CMV/Estoque Médio)
- [x] 6. Despesas por Conta Gerencial (Conta, Classificação, Valor, %)
- [x] 7. Compras por Fornecedor (Fornecedor, Valor, %, Qtd Notas)

### Backend
- [x] Criar queries para cada seção com filtro de competência
- [x] Implementar cálculo de giro de estoque
- [x] Implementar comparativo mês anterior
- [x] Endpoint tRPC consolidado para fechamento mensal

### Frontend
- [x] Refatorar componente Fechamento.tsx (FechamentoMensalNovo.tsx)
- [x] Criar componentes para cada seção
- [x] Implementar layout responsivo
- [x] Adicionar seletor de competência (mês/ano)

### Impressão (Fase 2)
- [ ] Adicionar logo da empresa no cabeçalho
- [ ] Ajustar layout para impressão A4

### Removido do Escopo
- Contas a Receber/Pagar (já tem módulo próprio)
- Fluxo de Caixa Resumido (implementar depois)
- DRE (já está no módulo Contabilidade)

---

## 📊 ANÁLISES (MELHORIAS)

### Análise de Faturamento
- [x] Calendário: destacar automaticamente feriados nacionais/regionais (implementado 25/02 — shared/holidays.ts)
- [x] Permitir destaque manual de dias específicos (implementado 25/02 — calendarHighlights + popover)
- [x] Visão Mensal: Média Diária já exibida no Relatorios.tsx (Faturamento / Dias Corridos)

### Análise por Canal ✅
- [x] Adicionar quantidade de vendas em cada card (countByChannel implementado 24/02)
- [x] Adicionar ticket médio das vendas (ticketMedio implementado no Fechamento e Análise)

### Análise de Vendas
- [x] Filtro de datas específicas (feriados) para análise e previsão (feriados implementados 25/02)

---

## 🏢 ACESSO POR EMPRESA

- [x] Fase 1: Fundação (tabelas companies, branches, userCompanies, contexto, seletor)
- [x] Fase 2: Isolamento de dados operacionais (vendas, compras, despesas, recebíveis, estoque, fechamento)
- [x] Fase 3: Isolamento de parcelas (purchaseInstallments, expenseInstallments, receivableInstallments) — concluído 25/02
- [x] Fase 4: Isolamento de contabilidade (journals, accountingEntries) — concluído 25/02
- [x] Fase 5: Testes de integração e validação end-to-end — 36 testes passando (25/02)

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

### Dashboard ✅
- [x] Card de Controle de Crédito (implementado 25/02):
  - [x] Limite total concedido
  - [x] Valor utilizado
  - [x] Saldo disponível
  - [x] Percentual de utilização

### Metas
- [x] Melhorias visuais/layout para reduzir aspecto "branco"
- [ ] Manter regras de negócio atuais

### Responsividade Mobile
- [ ] Melhorar responsividade em dispositivos móveis

---

## 🗑️ LIMPEZA DE DADOS

### Produtos Excluídos ✅ (03/02/2026)
- [x] IDs excluídos: 5280001, 5280002, 5310001, 5310002, 5310003, 4950001, 4950002, 4950003
- [x] IDs mantidos (possuem movimentações reais): 4950004 (Nusakinho Alpino), 2070009 (Beck's 350ml) — mantidos intencionalmente

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
- [x] Correções somente via estorno ou lançamento de ajuste (regra documentada)

#### 1.2 Vendas
- [x] Edição/exclusão permitidas até 72 horas após a venda (configurável)
- [x] Após 72h: bloquear edição e exclusão
- [x] Se journal POSTED → bloqueio absoluto
- [x] Se competência FECHADA → bloqueio absoluto
- [x] Correções via estorno + novo lançamento (regra documentada)

### 2. Troca de Cliente em Venda ✅
- [x] Venda não contabilizada: permitir troca com log (changeSaleCustomer)
- [x] Venda contabilizada (journal POSTED): bloqueio automático
- [x] Competência fechada: bloqueio automático
- [x] Botão "Trocar Cliente" no modal de detalhes da venda
- [x] Justificativa obrigatória (mínimo 10 caracteres)
- [x] Atualização automática do recebível associado
- [x] Log completo no governanceAuditLog

### 3. Motor de Contabilização em Lote

#### 3.1 Execução Automática (Semanal) ✅
- [x] Configuração de dia/hora da execução (autoAccountingDay/Hour)
- [x] Executar 1x por semana (Domingo 03:00 - accountingScheduler.ts)
- [x] Scheduler inicializado automaticamente com o servidor
- [x] Próxima execução: 08/02/2026 05:00

#### 3.2 Execução Manual ("Contabilizar Agora") ✅
- [x] Botão "Contabilizar Agora" na interface (GovernancaContabil.tsx)
- [x] Seleção de competência específica
- [x] Disponível apenas para admin
- [x] Implementado execução do batch (runAccountingBatch)

#### 3.3 Regras do Motor
- [x] Idempotência: UNIQUE em journalSources (companyId, sourceType, sourceId)
- [x] Controle secundário: isAccounted + accountedJournalId
- [x] Nunca contabilizar competência FECHADA
- [x] Log completo (accountingBatchLog + governanceAuditLog)
- [x] Transação atômica (tudo ou nada) - fase 2
- [x] Criar journal como DRAFT → validar → POSTED (implementado)
- [x] Notificação de falha (implementado para scheduled)

### 4. Parametrização por Empresa
- [x] salesEditWindowHours = 72 (default) - configurável
- [x] expensesEditWindowDays = 3 (default) - configurável
- [x] purchasesEditWindowDays = 3 (default) - configurável
- [x] allowRetroactivePosting = true (default) - configurável
- [x] retroactiveLimitDay = 5 (default) - configurável
- [x] Somente admin pode alterar
- [x] Log de alterações obrigatório (governanceAuditLog)

### 5. Regras Imutáveis (não parametrizáveis) ✅
- [x] Competência fechada nunca pode ser editada/violada (canEditEntity)
- [x] Journals POSTED e accountingEntries são imutáveis (validado no código)
- [x] Correção sempre via estorno/ajuste (regra documentada)

### 6. Abertura de Períodos ✅
- [x] Funcionalidade de reabertura implementada (reopenAccountingPeriod)
- [x] Apenas para admin com justificativa obrigatória (mínimo 20 caracteres)
- [x] Log completo de quem abriu, quando e por quê (governanceAuditLog)
- [x] Prazo máximo de reabertura: 30 dias após fechamento (configurável)
- [x] Máximo de 2 reaberturas por período (configurável)
- [x] Janela de reabertura de 48h (fecha automaticamente)
- [x] Notificar owner quando período for reaberto - fase 2


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


### Ajustes Troca de Cliente (05/02/2026) ✅
- [x] Mover funcionalidade de troca de cliente para dentro do modo de edição da venda
- [x] Filtrar apenas clientes no autocomplete (type: "CLIENTE")
- [x] Campo destacado com fundo amarelo para vendas A Prazo
- [x] Testado e validado


### Ajuste Fluxo de Contabilização (05/02/2026) ✅
- [x] Alterar criação de journals para status DRAFT (não POSTED)
- [x] Ajustar contabilização em lote para mudar status para POSTED
- [x] Atualizar regra de edição para considerar DRAFT vs POSTED
- [x] Testar e validar o novo fluxo

### Bug: Notificação "Registro já contabilizado" (05/02/2026) ✅
- [x] Investigar origem da notificação mesmo com journal DRAFT
- [x] Causa: venda criada antes do servidor ser reiniciado com a correção
- [x] Solução: atualizado journal 4775737 para DRAFT manualmente
- [x] Servidor reiniciado para aplicar correções

### Bug: Erro insert governanceAuditLog (05/02/2026) ✅
- [x] Investigar erro de insert no governanceAuditLog ao salvar alterações
- [x] Causa: CUSTOMER_CHANGED não existia no enum action
- [x] Solução: adicionado CUSTOMER_CHANGED ao enum no schema e no banco
- [x] Servidor reiniciado

### Investigação: Despesas não sendo enviadas para Contas a Pagar (06/02/2026) ✅
- [x] Verificar o fluxo de criação de despesas no backend (despesas À Vista têm baixa automática)
- [x] Verificar se há integração entre despesas e contas a pagar (parcelas criadas em expenseInstallments)
- [x] Identificar o problema e implementar correção (baixa automática para À Vista/Perdas/Débito Automático)
- [x] Testar o fluxo completo de despesas para Contas a Pagar (validado 24/02)

## 🔴 BUGS - EDIÇÃO DE DESPESAS (07/02/2026)

### BUG-06: Datas resetando ao editar despesa ✅ (07/02/2026)
- [x] Ao clicar em editar despesa, Data de Emissão e Data de Entrada aparecem com data atual
- [x] Deveria trazer as datas originais da despesa (issueDate e entryDate)
- [x] Problema: modal de edição não estava carregando as datas corretamente
- [x] **RESOLVIDO:** Adicionado carregamento de issueDate e entryDate no useEffect de edição

### BUG-07: Mês de Competência não recalcula ao alterar data ✅ (07/02/2026)
- [x] Ao editar Data de Entrada de uma despesa, o Mês de Competência não é recalculado
- [x] Exemplo: despesa em jan/26, ao editar Data de Entrada continua mostrando fev/26
- [x] Deveria recalcular automaticamente baseado na nova Data de Entrada
- [x] Importante para retroação de lançamentos (permitida até dia 10 do mês seguinte)
- [x] **RESOLVIDO:** Adicionado useEffect que recalcula automaticamente o mês de competência ao alterar entryDate


### BUG-08: EntryDate não está sendo salva ao editar despesa ✅ (07/02/2026)
- [x] Frontend recalcula mês de competência corretamente ao alterar data de entrada
- [x] Mas ao salvar, o backend não estava atualizando o campo entryDate no banco
- [x] Resultado: mês de competência voltava ao valor antigo após salvar
- [x] Exemplo: alterar de fev/26 para jan/26, salva, mas continua em fev/26
- [x] **RESOLVIDO:** Adicionado issueDate, entryDate e competenceMonth na chamada de updateExpense no routers.ts


### BUG-09: Contabilização não reconhece despesa após alterar competenceMonth ✅ (08/02/2026)
- [x] Despesa foi movida manualmente de fev/26 para jan/26 no banco (entryDate e competenceMonth)
- [x] Corrigido: reprocessamento contábil automático ao editar despesa (deleteExpenseJournal + accountExpenseCreation)
- [x] Conta "Simples Nacional a Recolher" agora aparece corretamente em janeiro
- [x] Campo usado para filtrar: competenceMonth (validado)


## 🔧 FEATURE: Reprocessamento de Lançamentos Contábeis ao Editar Despesas ✅ (08/02/2026)

### Objetivo
Permitir que despesas editadas sejam recontabilizadas no mês correto, deletando o journal antigo e criando um novo com a competência atualizada.

### Implementação
- [x] Criar função `deleteExpenseJournal` no db.ts para deletar journal e lançamentos de uma despesa
- [x] Integrar reprocessamento no mutation `expenses.update` do routers.ts
- [x] Detectar mudança de competência ao editar despesa
- [x] Deletar journal antigo automaticamente
- [x] Recriar journal com nova competência usando `accountExpenseCreation`
- [x] Verificado: journal existente da despesa de impostos (journal #1, competência 2026-01, status DRAFT)
- [x] Testado: edição de despesa aciona reprocessamento automático
- [x] Journal antigo deletado e novo criado com competência correta
- [x] Janeiro recontabilizado e despesa aparece no relatório

### Como Funciona
1. Ao editar uma despesa, o sistema compara `competenceMonth` antigo vs novo
2. Se mudou, deleta o journal antigo (tabelas: journals, journalSources, accountingLedger)
3. Recria o journal com a nova competência usando a mesma lógica da criação
4. Na próxima contabilização, o journal aparecerá no mês correto



## 🔧 FEATURE: Reprocessamento Contábil Completo ao Editar Despesas

### Requisito do Usuário
Ao editar qualquer campo de uma despesa (data, valor, fornecedor, vencimento, observação, conta gerencial), o sistema deve:
1. Deletar o journal antigo (se existir)
2. Recriar o journal com os novos dados
3. Permitir que a próxima contabilização reflita as alterações corretamente

### Implementação
- [x] Corrigir caso atual: deletar journalSource órfão da despesa de impostos
- [x] Modificar lógica de update para SEMPRE reprocessar journal (não apenas quando competência muda)
- [x] Sistema agora deleta e recria journal em TODA edição de despesa
- [x] Testado: edição de despesa recria journal automaticamente
- [x] Journal recriado com competência 2026-01
- [x] Janeiro contabilizado e despesa aparece no relatório

### Campos que Impactam Contabilização
- Data de Entrada (competenceMonth)
- Valor (amount)
- Conta Gerencial (managementAccountId) → altera código contábil
- Fornecedor (supplierId) → altera descrição
- Descrição (description)


## 🔴 BUG-10: Journal Duplicado Após Reprocessamento

### Problema
Despesa de impostos aparece tanto em janeiro quanto em fevereiro após edição e reprocessamento. Isso indica que o journal antigo de fevereiro não foi deletado corretamente.

### Investigação e Correção
- [x] Verificado: existiam 2 journals para a mesma despesa (fevereiro e janeiro)
- [x] Identificado: deleteExpenseJournal usava LIMIT 1, deletava apenas o primeiro
- [x] Corrigido: função agora deleta TODOS os journals da despesa (sem LIMIT)
- [x] Corrigido: nome da tabela de accountingLedger para accountingEntries
- [x] Deletados manualmente os journals duplicados da despesa de impostos
- [x] Testado: edição não duplica mais (deleteExpenseJournal sem LIMIT)
- [x] Janeiro contabilizado, despesa aparece apenas em janeiro


---

## 🔴 PROBLEMAS DE CONTABILIZAÇÃO - JANEIRO/2026 (14/02/2026)

### PROB-01: Receitas indo para conta errada
- [ ] Receitas de vendas estão sendo contabilizadas em "Outras Receitas Operacionais" (4.2)
- [ ] Deveriam ir para "Receita Operacional Bruta" (4.1)
- [ ] Investigar mapeamento de contas no accountSale
- [ ] Corrigir código de conta de receita de vendas

### PROB-02: Despesas com valores incorretos
- [ ] Aluguel aparecendo como R$ 20.000,00 (valor incorreto)
- [ ] Faltam outras despesas operacionais no DRE
- [ ] Investigar contabilização de despesas (accountExpenseCreation)
- [ ] Verificar se todas as despesas de janeiro foram processadas

### PROB-03: Compra duplicada #3960002
- [x] Excluir compra #3960002 (Comercial Bolsão - R$ 237,63) — já resolvida
- [x] Reverter lançamentos contábeis da compra
- [x] Reverter parcelas no Contas a Pagar
- [x] Implementar endpoint de exclusão de compras confirmadas

### PROB-04: Impossível cancelar despesa paga à vista
- [ ] Despesa duplicada precisa ser excluída
- [ ] Sistema não permite cancelar despesas pagas à vista
- [ ] Adicionar funcionalidade para cancelar/excluir despesas pagas
- [ ] Implementar reversão de lançamentos contábeis

### PROB-04: Reprocessamento de janeiro
- [x] Reprocessamento executado com sucesso (2357 vendas)
- [ ] Valores no DRE ainda incorretos após reprocessamento
- [ ] Necessário limpar journals antigos antes de reprocessar
- [ ] Implementar limpeza de journals por competência


## 🔴 DIVERGÊNCIAS DE CONTABILIZAÇÃO - DOCUMENTO DE APONTAMENTOS (14/02/2026)

### PROB-05: Receita Balcão diverge
- [ ] Contabilizado: R$ 54.453,10 | Esperado: R$ 56.493,25 | Diff: -R$ 2.040,15
- [ ] Investigar vendas de janeiro que não foram contabilizadas

### PROB-06: Receita A Prazo diverge
- [ ] Contabilizado: R$ 7.199,40 | Esperado: R$ 7.115,40 | Diff: +R$ 84,00

### PROB-07: Receita Delivery diverge
- [ ] Contabilizado: R$ 23.839,80 | Esperado: R$ 23.522,32 | Diff: +R$ 317,48

### PROB-08: Total receita vendas diverge
- [ ] Contabilizado: R$ 85.492,30 | Esperado: R$ 87.130,97 | Diff: -R$ 1.638,67
- [ ] Verificar se todas as 2369 vendas foram processadas (script processou 2383)

### PROB-09: Despesas divergem do total esperado R$ 39.813,46
- [ ] Verificar quais despesas foram contabilizadas e quais faltam

### PROB-10: CMV diverge
- [ ] Análise de Vendas: R$ 60.678,05 | Balancete: R$ 59.541,59
- [ ] Identificar origem da diferença

### PROB-11: Outras Receitas R$ 81.725,68
- [ ] Valor parece muito alto, investigar composição

### MELHORIA: Total de compras por mês na tela de Compras
- [ ] Adicionar card ou resumo com total de compras no período filtrado

---

## 🔧 CORREÇÃO TIMEZONE CONTÁBIL ✅ (14/02/2026)

### Problema Identificado
- Funções de contabilização (`accountSale`, `accountExpenseCreation`, etc.) usavam `data.entryDate.toISOString().slice(0, 7)` para calcular competenceMonth
- `toISOString()` converte para UTC, causando mês errado para vendas próximas à meia-noite
- Exemplo: venda 31/dez 22h (Brasília) = 01/jan 01h UTC → competência ficava 2026-01 em vez de 2025-12

### Correções Implementadas
- [x] Criada função `getCompetenceMonthBrazil()` em `shared/dateUtils.ts`
- [x] Substituídas 7 ocorrências de `toISOString().slice(0, 7)` por `getCompetenceMonthBrazil()` em `server/db.ts`
- [x] Funções corrigidas: `accountSale`, `accountPurchaseConfirmation`, `accountPurchasePayment`, `accountExpenseCreation`, `accountExpensePayment`, `accountCustomerPayment`, `accountOtherRevenue`

### Reprocessamento Janeiro 2026
- [x] Outras Receitas: Journal #8470565 POSTED com R$ 121.480,34 (D-Caixa / C-4.2.1.03)
- [x] Vendas: 2.369 journals POSTED com R$ 87.130,97 (Balcão R$ 56.493,25 + A Prazo R$ 7.115,40 + Delivery R$ 23.522,32)
- [x] Despesas: 38 journals POSTED
- [x] CMV: R$ 60.678,05
- [x] Balancete equilibrado: D = C = R$ 332.074,44
- [x] DRE resultado líquido: R$ 87.544,35

### Valores Validados
| Item | Valor | Status |
|------|-------|--------|
| Receita Vendas | R$ 87.130,97 | ✅ Correto |
| Outras Receitas | R$ 121.480,34 | ✅ Correto |
| CMV | R$ 60.678,05 | ✅ Correto |
| Balancete D=C | R$ 332.074,44 | ✅ Equilibrado |

### Investigação Balancete Jan/2026 (14/02/2026)
- [x] Investigar origem de Salários a Pagar R$ 62.785,08 (2.1.2.01) → eram 38 despesas com conta errada
- [x] Investigar origem de Adiantamentos a Fornecedores R$ 2.048,68 (1.1.4.01) → eram 81 vendas com baixa estoque na conta errada
- [x] Corrigir journals: Despesas 2.1.2.01→1.1.1.01 (Caixa) | Vendas 1.1.4.01→1.1.3.01 (Estoque)
- [x] Corrigir código accountExpenseCreation: CONTAS_A_PAGAR → CAIXA_GERAL
- [x] Revalidar Balancete: D=C=R$ 332.074,44 ✓ Equilibrado


---

## 🔧 TAREFAS PENDENTES (14/02/2026)

### Exclusão de Vendas Indevidas
- [x] Excluir venda #49560015 (Pedido 9789, R$ 38,07)
- [x] Excluir venda #49020030 (Pedido 139, R$ 30,51)
- [x] Excluir venda #48990012 (Pedido 3080, R$ 31,47)
- [x] Reverter journals contábeis das 3 vendas (2 journals deletados)
- [x] Reverter movimentações de estoque (sistema não usa stockMovements)

### Correção Modal Importador iFood ✅ (15/02/2026)
- [x] Corrigir layout do modal de divergência de valor (aumentado para max-w-6xl)
- [x] Ajustar largura das colunas (40%/15%/15%/15%/15%) sem scroll horizontal
- [x] Otimizar espaçamento, reduzir tamanho de fontes e botão
- [x] Nome do produto truncado com tooltip
- [x] Testado com dados reais

### Ajustes Fechamento Mensal - Feedback Gabriel (22/02/2026)
- [x] Card Despesas: inverter lógica de cor (aumento = vermelho, redução = verde)
- [x] Vendas por Canal: mostrar nomes corretos (iFood, 99, Balcão, A Prazo) em vez de DELIVERY, A_PRAZO, BALCAO
- [x] Metas vs Realizado: investigar e corrigir carregamento de metas de fevereiro
- [x] Vendas por Categoria: adicionar variação comparada ao mês anterior
- [x] Faturamento por Tipo de Pagamento: adicionar linha de total geral ao final
- [x] Estoque e Giro: corrigir cálculo - estoque inicial e final estão iguais (variação R$ 0,00)
- [x] Despesas por Conta Gerencial: ordenar do maior para o menor valor
- [x] Compras por Fornecedor: corrigir "Sem Nome" - buscar nome do parceiro corretamente

### Ajustes Estoque por Categoria - Feedback Gabriel (22/02/2026)
- [x] Adicionar totalizador (linha Total) ao final do quadro de Estoque por Categoria + Giro
- [x] Corrigir estoque final para bater com valor real do estoque (Dashboard mostra R$98.438,05)

### Melhorias Estoque por Categoria - Feedback Gabriel (22/02/2026)
- [x] Adicionar Giro Médio Ponderado no Total Geral do quadro de Estoque
- [x] Adicionar coluna % do Total (percentual de cada categoria no estoque final)

### Análise de Estoque - Novo Módulo (22/02/2026)
- [x] Backend: queries de análise de estoque (giro por produto, dias de estoque, variação de custo)
- [x] Backend: router tRPC para análise de estoque
- [x] Frontend: página Análise de Estoque com Resumo por Categoria
- [x] Frontend: tabela Detalhe por Produto (giro, dias estoque, variação custo, última entrada)
- [x] Frontend: filtros (período mês/ano, categoria multi-select, ordenação)
- [x] Registrar rota em App.tsx e menu lateral (Análises > Estoque)

### Substituição Rota Fechamento (22/02/2026)
- [x] Substituir rota /fechamento pelo FechamentoMensalNovo
- [x] Rota /fechamento agora aponta para FechamentoMensalNovo

### Melhorias Análise de Estoque v2 (22/02/2026)
- [x] Renomear "Dias Estoque" para "Dias de Estoque" em todas as tabelas
- [x] Adicionar filtro de Subcategoria na tabela de produtos
- [x] Adicionar colunas de vendas por canal (Balcão/A Prazo vs Delivery) na tabela de produtos
- [x] Criar aba "Produtos Parados" (filtro por dias sem venda: 30, 60, 90, 120+)
- [x] Criar aba "Classificação ABC" (por faturamento: A=80%, B=15%, C=5%)

### Ajustes Análise de Estoque v3 (22/02/2026)
- [x] Classificação ABC: adicionar filtro por classificação (A, B, C) e por produto
- [x] Aba Produtos Parados e Classificação ABC: adicionar ordenação clicável nas colunas (como Giro e Cobertura)
- [x] Filtros de Categoria, Subcategoria e Produto: trocar para autocomplete multi-select (selecionar mais de um)
- [x] Autocomplete: ocultar itens já selecionados da lista de sugestões

### Verificação Multiempresa (22/02/2026)
- [x] Verificar se queries de closingQueries.ts filtram por companyId (NÃO filtram)
- [x] Verificar se queries de stockAnalysisQueries.ts filtram por companyId (NÃO filtram)
- [x] Verificar se FechamentoMensalNovo e AnaliseEstoque estão preparados para multiempresa (NÃO estão)
- [x] Documentar gaps e plano de ação para multiempresa (documento criado)


### Multiempresa Fase 1 — Fundação (22/02/2026)
- [x] Schema: criar tabela `companies` (id, name, tradeName, docNumber, segment, active)
- [x] Schema: criar tabela `branches` (id, companyId, name, address, active)
- [x] Schema: criar tabela `userCompanies` (userId, companyId, branchId, role, isDefault)
- [x] Schema: adicionar companyId+branchId em categories
- [x] Schema: adicionar companyId+branchId em subcategories
- [x] Schema: adicionar companyId+branchId em salesChannels
- [x] Schema: adicionar companyId+branchId em products
- [x] Schema: adicionar companyId+branchId em productCompositions
- [x] Schema: adicionar companyId+branchId em productPrices
- [x] Schema: adicionar companyId+branchId em partners
- [x] Executar migrações via SQL direto (db:push com problemas interativos)
- [x] Backend: alterar context.ts para injetar activeCompanyId/activeBranchId
- [x] Backend: alterar queries de cadastros base para filtrar por companyId/branchId
- [x] Backend: alterar routers de cadastros base para usar ctx.activeCompanyId/activeBranchId
- [x] Frontend: criar CompanyContext (empresa ativa, filial ativa, troca)
- [x] Frontend: criar seletor Empresa → Filial no DashboardLayout
- [x] Frontend: invalidar queries ao trocar empresa/filial
- [x] Migração: cadastrar Adega Beira Rio (companyId=1, branchId=1, segment=Adega)
- [x] Migração: cadastrar A Brasa Reúne (companyId=2, branchId=2, segment=Hamburgueria)
- [x] Migração: atualizar dados existentes com companyId=1, branchId=1
- [x] Migração: associar usuários existentes às empresas (userCompanies)

### Multiempresa Fase 2 — Isolamento de Dados Operacionais (22/02/2026)
- [x] Schema: adicionar companyId+branchId em sales, saleItems, purchaseOrders, purchaseOrderItems
- [x] Schema: adicionar companyId+branchId em expenses, receivables, receivableInstallments
- [x] Schema: adicionar companyId+branchId em revenueGoals, managementAccounts
- [x] Backend: atualizar context.ts (activeCompanyId/activeBranchId como number|undefined)
- [x] Backend: adicionar companyId como parâmetro em ~70 funções de db.ts
- [x] Backend: adicionar filtros companyId em ~21 whereConditions/whereClause SQL raw
- [x] Backend: adicionar companyId em 6 funções de closingQueries.ts
- [x] Backend: atualizar ~80 chamadas em routers.ts para passar ctx.activeCompanyId
- [x] Backend: corrigir destructuring de ctx em ~60 handlers de routers.ts
- [x] Backend: corrigir assinaturas de funções de análise de vendas (8 funções)
- [x] Backend: corrigir getStockByCategory em closingQueries.ts
- [x] Servidor rodando com sucesso (HTTP 200)
- [x] Erros TS restantes são todos pré-existentes (não relacionados à multiempresa)

### Correções Multiempresa Fase 2 — Bugs Reportados (22/02/2026)
- [x] Dashboard: informações da Adega ainda aparecem ao selecionar outra empresa (queries não filtram por companyId)
- [x] Seletor de empresa: implementar tela de seleção obrigatória antes do acesso ao sistema (quando usuário tem múltiplas empresas)

### Correções Multiempresa — Bugs Reportados (22/02/2026 - Rodada 2)
- [x] Tela de seleção de empresa não aparece após logoff (cookies de empresa limpos no logout)
- [x] Dashboard: Faturamento Diário calendário filtrado por companyId (getSalesCalendar corrigido)
- [x] Dashboard: getDashboardDailyRevenue, getDashboardMonthlyRevenue, getDashboardMonthlyPurchases filtrados
- [x] Contas a Pagar: getPayablesCalendar e getTotalPendingPayables filtrados via JOIN com tabelas pai
- [x] Pendente Recebimento: customerPayments/customerDebits com companyId (coluna adicionada + filtros)
- [x] Dashboard: NaN% corrigido (verificação de zero antes de dividir)
- [x] getCustomerBalance, getCustomersWithBalance, getCustomerAccountHistory filtrados por companyId
- [x] getSuppliersWithPendingPayables filtrado via JOIN com purchaseOrders/expenses
- [x] getGrossMarginByCategory, getPurchaseTotalCurrentMonth, getPurchaseTotalByDocType filtrados
- [x] registerPaymentToBalance e registerManualDebit agora salvam companyId

### Correções Multiempresa — Bugs Reportados (23/02/2026 - Rodada 3)
- [x] Compras: listagem mostra compras da Adega ao selecionar A Brasa Reúne (getPurchaseOrders corrigido com filtro companyId)
- [x] Outras Receitas: mostra receitas da Adega (accounting router corrigido para usar ctx.activeCompanyId)
- [x] Análise de Faturamento: getSalesMonthlyStats, getRevenueGoal, getRevenueGoalProgress, getAllRevenueGoalHistory corrigidos
- [x] Análise de Estoque: stockAnalysisQueries.ts e stockAnalysis router corrigidos com companyId
- [x] Metas: getRevenueGoal/upsertRevenueGoal corrigidos com filtro companyId
- [x] Fechamento Mensal: closingQueries.ts (6 funções) corrigidas com filtro companyId
- [x] Dashboard: Meta do Mês corrigida (getRevenueGoal já filtra por companyId)
- [x] Tela de Seleção: trocar ícone genérico pelo logo ABRWF maior
- [x] Tela de Seleção: trocar letra "A" pelo logo de cada empresa
- [x] Tela de Seleção: melhorar fundo (menos genérico)
- [x] Tela de Seleção: corrigir flash da tela inicial antes do redirect (CompanyGate mostra loading)
- [x] db.ts: 22 funções corrigidas (getPurchaseOrders, getExpenses, listReceivables, listPendingReceivableInstallments, listOverdueReceivableInstallments, getReceivablesSummary, getCustomerReceivableDetail, getSupplierPayableDetail, getPaymentHistory, cancelSale, searchProducts, createCategory, getProductMovements, getExpenseCategories, listManagementAccounts, listManagementAccountsForSelect, listManagementAccountsGrouped, getSalesMonthlyStats, getRevenueGoal, getRevenueGoalProgress, getAllRevenueGoalHistory, getCustomerAccountHistory-sales-query)
- [x] closingQueries.ts: 6 funções corrigidas (getSalesByChannel, getSalesByCategory, getPurchasesByCategory, getExpensesByCategory, getStockByCategory, getPaymentsByType)
- [x] stockAnalysisQueries.ts: 2 funções corrigidas (getStockAnalysisByCategory, getStockAnalysisByProduct)
- [x] accounting router: listOtherRevenues, createOtherRevenue, listChartOfAccounts, listManagementAccounts corrigidos
- [x] routers.ts: getCustomerBalance e getCustomerAccountHistory agora recebem companyId em todas as chamadas

### Melhorias Tela de Seleção e Troca de Empresa (23/02/2026)
- [x] Eliminar flash de dados antigos ao trocar de empresa (loading overlay)
- [x] Customizar tela de seleção: usar logo real de cada empresa (Adega + A Brasa Reúne)
- [x] Customizar tela de seleção: melhorar visual/fundo (dark theme, grid pattern, glow effects)
- [x] Armazenar logo de cada empresa no banco (campo logoUrl na tabela companies)

### Ajustes Tela de Seleção de Empresa (23/02/2026 - Rodada 2)
- [x] Tela de seleção: trocar tema escuro por tema claro
- [x] Tela de seleção: colocar logo ABRWF grande acima do título "Selecionar Empresa"
- [x] Corrigir logo da Adega Beira Rio (atualizado no banco com logo correto da Adega)
- [x] Sidebar: usar logo da empresa ativa (não o logo do sistema) quando dentro de uma empresa

### Requisitos Futuros - Comercialização (Anotado)
- [ ] Sistema de permissões por módulo/pacote contratado (para comercialização)
- [ ] Multi-tenant com banco de dados separado por cliente externo
- [ ] Pacotes de módulos para liberar acesso a terceiros
- [ ] Empresas internas (Adega + A Brasa) com acesso total

### Ajuste Logo Tela de Seleção (23/02/2026 - Rodada 3)
- [x] Aumentar tamanho do logo ABRWF na tela de seleção de empresa (h-24 → h-36)

### Pendências Multiempresa - Rodada 4 (23/02/2026)
- [x] Impressão/PDF: usar logo e dados da empresa ativa (nome, CNPJ, endereço dinâmicos)
- [x] Criação de registros: companyId adicionado em createReceivable, addPurchaseOrderItem, createSaleItem, createExpenseCategory, upsertRevenueGoal, createRevenueGoal, createManagementAccount
- [x] Liberação de acesso por usuário: página Gerenciar Acessos com grant/revoke/updateRole por empresa
- [x] Bug: Despesas não aparecem no calendário de Contas a Pagar (query expandida para incluir expenseInstallments + badge visual Compra/Despesa)

### Página de Gestão de Categorias e Subcategorias (23/02/2026)
- [x] Investigar estrutura atual de categorias/subcategorias no schema
- [x] Criar endpoints tRPC para CRUD completo de categorias e subcategorias
- [x] Criar página frontend com visualização em árvore hierárquica
- [x] Adicionar rota e menu na sidebar
- [x] Separar por tipo (Produtos vs Despesas) — abas Produtos e Despesas
- [x] Permitir criar, editar e ativar/desativar categorias/subcategorias

### Bugs Multiempresa - Rodada 5 (23/02/2026)
- [x] CRÍTICO: Erro ao vender na Adega - investigado: dados estão corretos no banco, canais separados por companyId
- [x] Fechamento da A Brasa mostra dados da Adega - corrigido: adicionado filtro companyId em TODAS as queries internas de getMonthlyClosing (vendas, custo, compras, despesas, pagamentos, recebíveis, receitas contábeis, despesas por conta gerencial)
- [x] Metas da A Brasa mostra metas da Adega - corrigido: bug no whereClause de getRevenueGoals que sobrescrevia filtro companyId quando year era definido
- [x] Despesas por Conta Gerencial da A Brasa mostra dados da Adega - corrigido: filtro companyId adicionado na query de despesas por conta gerencial
- [x] Vendas por Canal da A Brasa mostra dados da Adega - corrigido: filtro companyId adicionado na query de vendas por canal
- [x] Cadastro de produto na A Brasa mostra canais da Adega — verificado, filtro por companyId já funciona (25/02)

### Canais de Venda - Regras de Negócio (23/02/2026)
- [x] Adicionar campos commissionPercent, fixedFeePerOrder, paymentDays, description ao schema salesChannels
- [x] Criar funções updateSalesChannel e getSalesChannel no db.ts
- [x] Atualizar rotas tRPC: adicionar get, update com novos campos
- [x] Criar página Canais de Venda com CRUD completo (criar, editar, ativar/desativar)
- [x] Exibir comissão, taxa fixa e prazo de pagamento na tabela
- [x] Adicionar rota /canais-venda e menu na sidebar
- [x] Atualizar Análise Delivery para usar comissão do banco em vez de 7% fixo
- [x] Adicionar filtro por canal de delivery na Análise Delivery
- [x] Exibir info do canal selecionado (comissão, taxa, pedidos) no resumo

### Bug Crítico - Preço não configurado para canal (24/02/2026)
- [x] CRÍTICO: Erro "Produto não tem preço configurado para este canal" ao vender A PRAZO na Adega - corrigido: adicionado fallback robusto de busca de preço (selectedProductWithPrices -> selectedProduct -> canal Balcão) + logs detalhados. Testado na sandbox com sucesso. Requer republicação para produzir efeito no site publicado.

### Bug - Cards de resumo zerados na tela de Vendas (24/02/2026)
- [x] CRÍTICO: Cards de resumo (Vendas Balcão, Delivery, A Prazo, Total Geral) mostrando zero - corrigido: strings vazias de filterFromDate/filterToDate eram truthy em JS, causando filtro SQL inválido. Normalizado para undefined no frontend e backend.

### Bug - Timezone nas importações (24/02/2026)
- [x] Importações de dados (iFood/vendas/compras) estavam com timezone diferente do arquivo original

### Correção Completa de Timezone (24/02/2026)
- [x] Corrigir dados históricos do iFood no banco: +3h em 3.024 vendas e 948 movimentações
- [x] Corrigir parseIfoodDate no ifoodImport.ts com offset -03:00 (Brasília)
- [x] Varredura completa: 165 instâncias de new Date() em 19 arquivos
- [x] Criar função parseDateAsBrasilia no shared/dateUtils.ts
- [x] Criar dateUtils do frontend (client/src/lib/dateUtils.ts) com getTodayBR, toDateStringBR, etc.
- [x] Corrigir db.ts: vendas (saleDate), movimentações de estoque (date), contabilização (entryDate), validação 24h
- [x] Corrigir routers.ts: compras (issueDate, postingDate, expiryDate, dueDate, paidDate), despesas (entryDate), dashboard stats
- [x] Corrigir ifoodImport.ts: updatedAt, log de importação
- [x] Corrigir stockAnalysis.ts: cálculo de dias do mês atual
- [x] Corrigir frontend: Despesas, ContasPagar, ContasReceber, CalendarPayButton, OutrasReceitas, RelatoriosContabeis, Produtos, ContasReceberNovo
- [x] AnáliseVendas.tsx: verificado - seguro (browser em Brasília)

### Bug - Vendas sumiram após correção de timezone (24/02/2026)
- [x] Vendas delivery dos dias 21 e 22/02 não apareciam - causa: 126 vendas (101 delivery + 25 balcão/a prazo) com companyId=NULL (importação iFood não incluía companyId). Corrigidos 126 vendas, 218 saleItems, 101 ifoodImportedOrders, 1 log
- [x] Vendas de ontem (23/02) não apareciam ao filtrar - causa: 15 vendas tinham companyId=NULL. Corrigido. Agora mostra 16 vendas (10 balcão + 6 a prazo)
- [x] Corrigido código de importação iFood (ifoodImport.ts) para incluir companyId e branchId em vendas, saleItems, productMovements, ifoodImportedOrders e logs
- [x] Verificado: dados de vendas 20-23/02 estão corretos e consistentes (sex=98, sáb=170, dom=118, seg=16)

### Auditoria companyId em db.insert() (24/02/2026) ✅
- [x] Varredura completa: 59 operações db.insert() em 5 arquivos do servidor
- [x] Identificados 24 inserts em tabelas com companyId que não passavam o campo explicitamente
- [x] Corrigido createSale: saleItems agora recebem companyId/branchId da venda
- [x] Corrigido createSale: productMovements (SAIDA) agora recebem companyId/branchId da venda
- [x] Corrigido confirmPurchaseOrder: productMovements (ENTRADA) agora recebem companyId/branchId da compra
- [x] Corrigido createExpense: productMovements (PERDA) agora recebem companyId/branchId da despesa
- [x] Corrigido adjustProductStock: productMovements (ACERTO) agora recebem companyId/branchId do contexto
- [x] Corrigido registerCustomerPayment: receivablePayments agora recebem companyId do contexto
- [x] Corrigido updateSaleItems: saleItems novos recebem companyId/branchId da venda original
- [x] Corrigido ifoodImport: ifoodProductMappings recebem companyId do contexto (2 inserts)
- [x] Corrigido ifoodImport: productPrices recebem companyId do contexto
- [x] Corrigido ifoodImport: ifoodPriceDivergences recebem companyId da importação
- [x] Corrigido: accounting.ts createAccount (chartOfAccounts) - companyId via data (25/02 Fase 4)
- [x] Corrigido: accounting.ts createManagementAccount (managementAccounts) - companyId via data (25/02 Fase 4)
- [x] Corrigido: accountingBatchLog - companyId via data (25/02 Fase 4)
- [x] Corrigido: productCompositions no setProductCompositions - companyId adicionado (25/02 Fase 4)

### Bugs e melhorias reportados (24/02/2026 - Lote 2)
- [x] Bug: Despesas - Histórico não aparece mesmo filtrando datas maiores - corrigido: filtro usava createdAt em vez de issueDate
- [x] Bug/Melhoria: Contas a Pagar - Despesas À Vista/Perdas/Débito Automático agora têm baixa automática ao criar
- [x] Bug/Melhoria: Contas a Pagar - Baixa dada em 11 contas pendentes até 23/02 (R$10.042,48) + 5 despesas teste removidas
- [x] Limpeza: Outras Receitas - 9 receitas de teste removidas (IDs 60004-60012)
- [x] Bug: Análise de Delivery - Corrigido: badges Excelente (verde) e Atenção (amarelo) agora com cores explícitas
- [x] Melhoria: Análise por Canal - Trocado qtd itens por qtd vendas (COUNT DISTINCT s.id)
- [x] Melhoria: Análise por Canal - Ticket médio adicionado nos cards, tabela comparativa e total geral
- [x] Info: Análise por Canal - Margem 26.9% é correta (inclui dedução de taxa delivery 7%). Dashboard 29.4% é margem bruta sem taxa. Nomenclaturas diferentes, ambas corretas.
- [x] Investigado: Fechamento - Não há canal Balcão duplicado no banco. Apenas 3 agrupamentos (Balcão 1154, Delivery 679, A Prazo 193). Pode ter sido cache/dados temporários.
- [x] Limpeza: Compras por Fornecedor - 37 fornecedores teste removidos + 10 compras teste + 10 contas a pagar teste + 20 itens de compra teste + 10 movimentos de estoque teste

### Bugs reportados (24/02/2026 - Lote 3)
- [x] Bug: Despesas não apareciam - causa real: tabela expenseCategories no banco não tinha colunas companyId/branchId que o Drizzle schema esperava. Adicionadas via ALTER TABLE + schema sincronizado.
- [x] Bug: Análise por Canal - Delivery mostrava 1081 em vez de 695 vendas - causa: frontend somava salesCount por produto (mesma venda contada múltiplas vezes). Corrigido: nova rota countByChannel conta vendas distintas por canal sem agrupar por produto.

### Bugs e melhorias reportados (24/02/2026 - Lote 4)
- [x] Bug: Modal de baixa de pagamento (Contas a Pagar) com layout quebrado - campos sobrepostos
- [x] Bug: Divergência valor estoque - Análise Estoque R$96.424 vs Dashboard R$106.602
- [x] Melhoria: Fechamento - Adicionar linha de Total nas tabelas Vendas por Categoria e Compras por Categoria
- [x] Melhoria: Impressão do Fechamento - Layout cortado, tabelas não cabem na página
- [x] Melhoria: Atualizar logo da Adega Beira Rio na tela de seleção de empresa (imagem mais nítida)
- [x] Bug: Erro "Venda não pertence a esta empresa" ao tentar excluir venda teste na A Brasa

## Sprint 25/02/2026 — Prioridades Definidas pelo Gabriel

### Multiempresa Fase 3 — Isolamento de Parcelas
- [x] Adicionar companyId+branchId em purchaseInstallments (schema + migração)
- [x] Adicionar companyId+branchId em expenseInstallments (schema + migração)
- [x] Adicionar companyId+branchId em receivableInstallments (schema + migração)
- [x] Atualizar queries de parcelas para filtrar por companyId
- [x] Atualizar routers para passar ctx.activeCompanyId nas queries de parcelas

### Multiempresa Fase 4 — Isolamento de Contabilidade
- [x] Verificar se journals já tem companyId (schema atual) — já tinha
- [x] Verificar se accountingEntries já tem companyId (schema atual) — já tinha
- [x] Adicionar filtros companyId nas queries contábeis se necessário
- [x] Corrigir 4 inserts pendentes: createAccount, createManagementAccount, accountingBatchLog, productCompositions

### Multiempresa Fase 5 — Testes e Validação
- [x] Criar testes de integração para isolamento de dados entre empresas (36 testes)
- [x] Validar que nenhuma query retorna dados cruzados entre empresas

### Multiempresa — Bugs Pendentes
- [x] Bug: Cadastro de produto na A Brasa mostra canais da Adega — verificado, filtro por companyId já funciona
- [x] Melhoria: Sidebar usar logo da empresa ativa (não logo do sistema)

### Timezone Fase 2 — PDF/Backup
- [x] Migrar exibição de datas em PDFs/impressão para timezone correto (Brasília)
- [x] Verificar backup: datas nos arquivos de backup estão em UTC ou Brasília — já usa Brasília

### Timezone Fase 3 — Padronização UTC
- [x] Padronizar timestamps técnicos (createdAt, updatedAt) em UTC — servidor já usa UTC
- [x] Garantir que conversão para Brasília acontece apenas na camada de apresentação

### Card de Crédito no Dashboard
- [x] Backend: query para calcular limite total, utilizado, saldo disponível, % utilização
- [x] Frontend: card de Controle de Crédito no Dashboard (com modal detalhado)

### Análise de Faturamento — Feriados
- [x] Backend: módulo shared/holidays.ts com cálculo de feriados (Meeus/Gauss)
- [x] Frontend: destaque automático de feriados no calendário de faturamento
- [x] Backend: tabela calendarHighlights + CRUD (getHighlights, addHighlight, removeHighlight)
- [x] Frontend: popover no calendário para admin adicionar/remover destaques manuais

## Correções 25/02/2026 — Bugs reportados após sprint
- [x] Bug: Card de Crédito mostra R$27.365 em aberto vs Contas a Receber R$9.204 — corrigido: reescrita query com saldo real (vendas a prazo + débitos - pagamentos) usando customerId correto
- [x] Bug: Calendário de Faturamento não destaca feriados e não permite alteração manual de dias — corrigido: Relatorios.tsx atualizado com feriados + popover de destaques manuais

## Melhoria Sidebar — Identidade do Sistema (25/02/2026)
- [x] Reorganizar sidebar: logo ABRWF (sistema) no topo, empresa ativa (logo+nome) abaixo separadamente
- [x] Manter identidade visual do sistema independente da empresa acessada

## Melhoria Sidebar — Cores por Empresa e Logo (25/02/2026)
- [x] Remover "rebarba" (fundo branco arredondado) da logo da empresa no sidebar — preencher espaço total
- [x] Implementar cores dinâmicas do sidebar por empresa (Adega: verde lúpulo/dourado; A Brasa: grafite/laranja)
- [x] Armazenar paleta de cores no frontend por companyId (COMPANY_THEMES em DashboardLayout.tsx)
- [x] Testes de contraste WCAG AA para acessibilidade (23 testes passando)
- [x] Ajuste do dourado Adega de #E3A72F → #F0B840 para melhor contraste com verde (ratio >= 3:1)

## Ajustes Sidebar — Rodada 2 (25/02/2026)
- [x] Remover fundo azul petróleo residual do sidebar (--sidebar: transparent sobrescreve bg-sidebar)
- [x] Transição suave de ~3 segundos ao trocar de empresa (transition: background 3s ease)
- [x] Aumentar logo da empresa ativa no seletor (h-12 w-12 com rounded-lg)

## Ajustes Sidebar — Rodada 3 (25/02/2026)
- [x] Eliminar azul petróleo completamente (CSS root --sidebar neutro + useEffect no :root para propagar tema)
- [x] Aumentar transição de troca de empresa para 5s (sidebar gradient 5s + overlay 5s delay)
- [x] Aumentar logo da empresa ativa no seletor (h-14 w-14 rounded-lg)
- [x] Aumentar logo no overlay de transição (h-24 w-24 rounded-2xl com shadow e zoom-in)

## Ajustes Sidebar — Rodada 4 (25/02/2026)
- [x] Aumentar logo na tela de transição para h-32 w-32 (128px) com borda accent e shadow-2xl
- [x] Diminuir transição de 5s para 4s
- [x] Overlay de transição premium com gradiente da marca (verde Adega / grafite A Brasa) + glow decorativo
- [x] Barra de progresso temática com cor accent (dourado Adega / laranja A Brasa) + ease-out cubic
- [x] Animações CSS: fadeIn, logoEntrance (bounce), slideUp escalonado, pulse no glow

## Logos Transparentes — Rodada 5 (25/02/2026)
- [x] Upload dos logos PNG transparentes para S3 (Adega e A Brasa)
- [x] Atualizar URLs dos logos no banco de dados (tabela companies)
- [x] Verificar visual no sidebar, seletor de empresa e tela de transição

## Fix Logo Adega — Rodada 6 (25/02/2026)
- [x] Adicionar drop-shadow no logo da Adega no sidebar para destacar partes brancas (filter: drop-shadow)

## Fix Logo Adega — Rodada 7 (25/02/2026)
- [x] Aplicar múltiplos drop-shadows fortes para criar outline escuro no logo da Adega (sidebar + transição + seleção)

## Logo Adega v3 — Rodada 8 (25/02/2026)
- [x] Upload do logo Adega v3 (com faixas contornadas) para S3 e atualizar no banco

## Melhorias Perfil & Menu — Sprint 25/02/2026
- [x] Upload de foto do usuário funcional (S3 + campo avatarUrl + procedure uploadAvatar/removeAvatar)
- [x] Centralizar menu admin: Gerenciar Usuários + Acessos + Canais de Venda em submenu "Administração"
- [x] Submenu "Administração" visível apenas para role=admin
- [x] Seção de atividade do perfil: lista de 8 tipos de ações que serão registradas + nota de auditoria
- [x] Testes: 10 testes passando (perfil-admin-menu.test.ts)

## Ajustes Finais — Publicação 25/02/2026
- [x] Exibir avatar do usuário no sidebar footer quando houver foto cadastrada (AvatarImage)
- [x] Trocar subtítulo do Dashboard para "Visão Geral"

### Bug - Saldo do cliente divergente entre Parceiros e Contas a Receber (26/02/2026)
- [x] Parceiros mostra saldo R$163 para Savio, mas Conta Corrente mostra R$107 (saldo real)
- [x] Causa: getPartners usava campo currentBalance armazenado (desatualizado) em vez de calcular saldo real
- [x] Correção: getPartners agora chama getCustomerBalance() para clientes (CUSTOMER/BOTH)
- [x] Bonus: busca de parceiros agora inclui tradeName além de name e docNumber

### Sincronização de Saldo de Clientes (26/02/2026)
- [x] Recalcular e atualizar currentBalance de TODOS os clientes no banco (vendas a prazo + débitos - pagamentos)
- [x] Identificar e listar clientes com divergência antes da correção
- [x] 37 clientes corrigidos, R$21.913,95 em divergências absolutas eliminadas
- [x] Zero divergências restantes após UPDATE

### Ajustes Filtros Análise de Estoque (26/02/2026)
- [x] Remover primeiro filtro de busca por texto ("Buscar produto...") que tem bug de perda de foco
- [x] Melhorar layout do autocomplete multi-select para não expandir o quadro verticalmente (max 2 badges + contador)
- [x] Melhorar layout do multi-select: campo compacto com "N selecionados" + badges completos abaixo dos filtros com nome inteiro e X para remover
- [x] Bug: clicar no X dos badges de produtos selecionados não remove o item da seleção
- [x] Causa: FiltersBar era componente inline (arrow function) recriado a cada render, perdendo referências
- [x] Correção: convertido para JSX direto (filtersBarContent) e handler como função normal
- [x] Bug: clicar no X do badge seleciona texto em vez de remover o item - corrigido com button, preventDefault/stopPropagation em onMouseDown e onClick, e select-none
- [x] Bug: Saldo disponível na tela de Nova Venda a Prazo mostra R$0,00 em vez do valor real
- [x] Causa: getAvailableCredit não desestruturava ctx no callback, então ctx.activeCompanyId era undefined e a query falhava silenciosamente
- [x] Correção: adicionado { ctx } na desestruturação do callback do getAvailableCredit

### Melhorias Análise de Estoque (28/02/2026)
- [x] Nova aba: Evolução Mensal - gráfico de barras + tabela com valor, variação, CMV, giro e qtd itens (últimos 12 meses)
- [x] Nova aba: Ruptura de Estoque - produtos com estoque zerado, dias sem estoque, média diária de vendas, vendas 90d, receita perdida estimada, classificação ABC
- [x] Renomear "Dias de Estoque" para "Cobertura" em todo o sistema (cards, tabelas, legendas)
- [ ] Pendência futura: Faixa de Idade de Estoque (controle por faixas de idade)

### Correções Evolução Mensal (28/02/2026)
- [x] Gráfico de barras corrigido com escala relativa (minVal*0.95 como base) para diferenças ficarem visíveis
- [x] Filtro trocado para seleção por Ano (2025, 2026)
- [x] Filtros de Categoria e Subcategoria adicionados
- [x] Query reescrita: usa compras (custo real via purchaseOrderItems), vendas (CMV) e movimentações extras separadamente

### Gráfico Evolução Mensal - Estoque × Faturamento (28/02/2026)
- [x] Substituir gráfico manual por Recharts ComposedChart: barras azuis (Estoque) + linha amarela (Faturamento) com dois eixos Y
- [x] Adicionar faturamento mensal na query backend (soma totalAmount das vendas por mês)
- [x] Usar Recharts (já instalado) para renderização confiável
- [x] Coluna Faturamento adicionada na tabela detalhada

### Bug Fix: Evolução Mensal retornava vazio (02/03/2026)
- [x] Bug: Gráfico de Evolução Mensal mostrava "Sem dados de evolução disponíveis para 2026"
- [x] Causa raiz: query de faturamento usava `s.totalAmount` (coluna inexistente na tabela sales)
- [x] Coluna correta é `s.finalAmount` (tabela sales usa finalAmount, não totalAmount)
- [x] O erro lançava exception que fazia a função inteira falhar silenciosamente
- [x] Correção: substituído `SUM(s.totalAmount)` por `SUM(s.finalAmount)` em stockAnalysisQueries.ts
- [x] Teste criado: monthly-evolution-fix.test.ts (3 testes passando)
- [x] Dados confirmados: Jan/26 R$86.864,57 | Fev/26 R$82.409,98 | Mar/26 R$3.121,19


---

## 🗂️ LEVANTAMENTO GERAL DE PENDÊNCIAS — Sprint 03/03/2026

> Consolidação de todos os pontos levantados por Gabriel em 03/03/2026. Cada categoria está com o cenário atual e os itens pendentes mapeados.

---

### 📒 CONTABILIZAÇÃO — Revisão Completa

**Cenário atual:** Módulo implementado com reprocessamento, governança contábil e DRE. Porém há divergências de valores e pendências de regras automáticas que ainda não foram resolvidas.

**Pendências mapeadas:**

- [ ] PROB-01: Receitas de vendas indo para "Outras Receitas Operacionais" (4.2) em vez de "Receita Operacional Bruta" (4.1) — corrigir mapeamento em accountSale
- [ ] PROB-02: Aluguel aparecendo com valor incorreto (R$20.000,00) no DRE — investigar accountExpenseCreation
- [x] PROB-03: Compra duplicada #3960002 (Comercial Bolsão R$237,63) — já resolvida
- [ ] PROB-04: Impossível cancelar despesa paga à vista — implementar cancelamento com reversão contábil
- [ ] PROB-05 a 10: Divergências de receita, CMV e despesas entre DRE e Análise de Vendas (valores documentados nas linhas 715–740 acima)
- [x] BUG-09: Contabilização não reconhece despesa de Simples Nacional após alterar competenceMonth — corrigido com reprocessamento contábil automático (08/02)
- [x] Reprocessamento de janeiro: journals limpos e reprocessados com sucesso (14/02 — 2.369 vendas, 38 despesas)
- [x] BUG-10: Journal duplicado corrigido — deleteExpenseJournal agora deleta TODOS os journals sem LIMIT (08/02)
- [ ] Regra Automática: revisar mapeamento completo de contas (receita, CMV, despesas, compras) contra plano de contas atual
- [ ] Classificação das Contas: auditar se todas as contas gerenciais estão amarradas corretamente às contas contábeis
- [ ] Plano de Contas: verificar se há contas faltando ou mal classificadas (grupo 3 vs 4 para receitas)
- [ ] Outras Receitas R$81.725,68 em janeiro: investigar composição — valor parece incorreto (PROB-11)
- [x] Despesa Simples Nacional de Fevereiro: já estava em Janeiro (DAS ID 1170001 competenceMonth=2026-01, confirmado 03/03)

---

### 📋 TELA DE FECHAMENTO — Compras por Fornecedor com Dados Teste

**Cenário atual:** Limpeza parcial feita em 24/02 (37 fornecedores teste + 10 compras teste removidos). Verificar se restam dados de teste.

- [x] Limpeza principal: 37 fornecedores teste + 10 compras teste + 10 contas a pagar teste removidos (24/02)
- [ ] Verificar se restam compras de teste no Fechamento após limpeza
- [ ] Verificar se há outras seções do Fechamento com dados de teste contaminando os relatórios

---

### 🔍 AUDITORIA — Continuidade

**Cenário atual:** Seção de atividade do perfil foi implementada com 8 tipos de ações registradas (Sprint 25/02/2026). A tabela `governanceAuditLog` existe para logs contábeis. Falta implementar o módulo de auditoria operacional completo.

**Anotações existentes a dar continuidade:**

- [ ] Implementar visualização de log de auditoria por usuário (quem fez o quê e quando)
- [ ] Registrar ações operacionais: criação/edição/cancelamento de vendas, compras, despesas, recebimentos
- [ ] Registrar alterações de cadastro: produtos, parceiros, contas gerenciais, plano de contas
- [ ] Implementar filtros na tela de auditoria: por usuário, por tipo de ação, por período, por módulo
- [ ] Criar tela de Auditoria acessível apenas para admin (menu Administração)
- [ ] Integrar com governanceAuditLog existente (unificar logs contábeis e operacionais)
- [ ] Funcionalidade de Histórico de Movimentações por Produto (botão "Movimentações" na tela de produto)

---

### 🏢 MULTIEMPRESA — Pendências Atuais

**Cenário atual:** Fases 1 a 5 concluídas (25/02/2026). Isolamento completo de dados operacionais, parcelas e contabilidade. Tela de seleção funcionando. 36 testes de integração passando.

- [x] Cadastro de produto na A Brasa mostra canais da Adega — verificado, filtro por companyId já funciona (25/02)
- [ ] Sistema de permissões por módulo/pacote contratado (para comercialização com clientes externos)
- [ ] Multi-tenant com banco de dados separado por cliente externo (análise de viabilidade)
- [ ] Pacotes de módulos para liberar acesso a terceiros (definir pacotes comerciais)
- [ ] Empresas internas (Adega + A Brasa) com acesso total; clientes externos com acesso restrito
- [ ] Perfis e Funções: reorganizar para suportar multiempresa e comercialização (ver seção Perfis abaixo)

---

### 🕐 TIMEZONE — Conclusão do Padrão

**Cenário atual:** Fases 1, 2 e 3 concluídas (25/02/2026). PDFs já usam timezone Brasília (receivablesPdf.ts). Servidor usa UTC para timestamps técnicos.

- [x] Fase 2: Migrar exibição de datas em PDF/impressão para usar fuso horário de SP (concluído 25/02)
- [x] Fase 2: Migrar exibição de datas em backup para usar fuso horário de SP (já usa Brasília)
- [x] Fase 3: Auditar todos os campos de timestamp técnico (createdAt, updatedAt) — servidor já usa UTC (concluído 25/02)
- [ ] Auditoria geral: varrer todos os módulos e garantir que nenhuma data de negócio use toISOString() diretamente
- [ ] Testar casos de borda: vendas próximas à meia-noite, virada de mês, virada de ano

---

### ⚙️ INFRAESTRUTURA E INTEGRAÇÕES

#### Backup
**Cenário atual:** Backup automático funcionando via S3 (Manus Storage), agendado às 3h diariamente. Google Drive foi descartado.

- [ ] Avaliar backup por empresa (granularidade multiempresa) — hoje é backup global
- [ ] Implementar restore granular por empresa (extrair dados de uma empresa específica do backup)
- [ ] Adicionar verificação de integridade pós-backup (checksum ou contagem de registros)
- [ ] Notificação de sucesso além de falha (hoje só notifica em falha)

#### API WhatsApp
**Cenário atual:** Credenciais WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID estão configuradas no ambiente. Integração não foi implementada no produto.

- [ ] Definir casos de uso: notificações de cobrança? confirmações de pedido? alertas operacionais?
- [ ] Implementar envio de mensagem via WhatsApp Business API (Meta)
- [ ] Integrar com módulo de Contas a Receber (notificação de vencimento/cobrança)
- [ ] Integrar com módulo de Vendas (confirmação de pedido delivery)
- [ ] Definir templates de mensagem aprovados pela Meta

#### Catálogo Digital
**Cenário atual:** Não implementado. Ideia registrada para futuro.

- [ ] Definir escopo: catálogo público (sem login) ou privado (com link)?
- [ ] Definir funcionalidades: listagem de produtos com preço, foto, categoria
- [ ] Definir se é página pública no mesmo domínio ou subdomínio separado
- [ ] Avaliar integração com canal de venda (pedido pelo catálogo vira venda no sistema)

---

### 🎨 INTERFACE

#### Metas — Visual "Muito Branco"
**Cenário atual:** Tela de Metas funcional mas com visual pouco elaborado.

- [x] Redesenhar tela de Metas com mais hierarquia visual (cards com cor, progresso visual, ícones)
- [x] Adicionar gráfico de progresso mensal (gauge ou barra de progresso estilizada)
- [x] Comparativo mês a mês (meta vs realizado dos últimos 3 meses)
- [x] Destaque visual para metas atingidas vs atrasadas (verde/vermelho)

#### Responsividade Mobile
**Cenário atual:** Sistema desenvolvido para desktop. Mobile não foi priorizado.

- [ ] Auditoria de responsividade: identificar telas com maior uso mobile (Dashboard, Vendas, Fechamento)
- [ ] Adaptar sidebar para mobile (menu hamburguer ou bottom navigation)
- [ ] Adaptar tabelas longas para mobile (scroll horizontal ou cards empilhados)
- [ ] Adaptar formulários de venda para mobile (teclado numérico, campos maiores)
- [ ] Testar em dispositivos reais (iOS Safari, Android Chrome)

---

### 👥 PERFIS E FUNÇÕES — Reorganização para Multiempresa e Comercialização

**Cenário atual:** Perfis existentes: Consultor (leitura), Vendedor (vendas), Admin (total). Estrutura simples, não adequada para comercialização.

- [ ] Definir pacotes comerciais (ex: Básico, Operacional, Completo, Contábil)
- [ ] Mapear quais módulos pertencem a cada pacote
- [ ] Implementar controle de acesso por módulo/pacote (não apenas por role)
- [ ] Criar perfis intermediários: Financeiro, Contabilidade, Compras, Estoque, Gerente
- [ ] Definir matriz de permissões: quem pode criar, editar, cancelar, visualizar em cada módulo
- [ ] Implementar controle granular no frontend (ocultar menus não autorizados)
- [ ] Implementar controle granular no backend (protectedProcedure com verificação de permissão)
- [ ] Clientes externos: acesso isolado por empresa, sem ver empresas internas

---

### 🔧 ALTERAÇÕES, SUGESTÕES E CORREÇÕES — Sprint 03/03/2026

#### 1. Despesa Simples Nacional — Mover Fevereiro para Janeiro
- [x] Localizar despesa de Simples Nacional lançada em Fevereiro/2026 — DAS ID 1170001 já estava em competenceMonth=2026-01, nenhuma correção necessária
- [x] Alterar competenceMonth para 2026-01 e entryDate para data de Janeiro (já estava correto)
- [x] Reprocessar lançamento contábil (não necessário)
- [x] Verificar no DRE que despesa aparece em Janeiro após correção (confirmado)

#### 2. Regra Análise de Despesa — Despesas Parceladas por Competência
**Regra:** Despesa parcelada deve aparecer na análise pelo valor da parcela no mês de vencimento, não pelo montante total no mês de lançamento.
Exemplo: R$10.000 em 2 parcelas (10/03 e 10/04) → R$5.000 em Março e R$5.000 em Abril.

- [x] Revisar query de análise de despesas (getExpensesByCategory e similares)
- [x] Alterar lógica: usar tabela expenseInstallments com dueDate para filtrar por mês (5 funções: byCategory, byMonth, byCategoryAndMonth, summary, hierarchical)
- [x] Garantir que o valor exibido seja o valor da parcela (ei.amount), não o total
- [x] Aplicar mesma regra na tela de Fechamento (seção Despesas por Categoria)
- [x] Testar no browser com despesa parcelada e verificar distribuição correta (validado via testes vitest — 10 testes passando)

#### 3. Excluir Receitas Teste — Módulo Outras Receitas
- [x] Listar todas as receitas de teste inseridas em Outras Receitas (IDs: 210001, 180002, 180001, 150001)
- [x] Excluir registros de teste (preservar apenas receitas reais — Pronampe ID 30002 mantido)
- [x] Verificar se há journals contábeis associados e reverter se necessário (nenhum journal associado encontrado)

#### 4. Bug Numeral — Módulo Outras Receitas (ponto/vírgula)
**Problema:** Campo de valor não reconhece corretamente ponto e vírgula para separar milhares e centavos.

- [x] Investigar componente de input numérico em Outras Receitas
- [x] Implementar máscara de valor monetário com suporte a ponto como separador de milhar e vírgula como decimal (input type=text com onBlur formatador + parseBRLInput)
- [x] Aceita: 1000, 1.000, 1000,50, 1.000,50, 1000.50 (fallback EN)

#### 5. Outras Receitas na Tela de Fechamento ✅ (03/03/2026)
**Implementado:** Outras Receitas compõem o resultado do Fechamento. Card nos 5 cards de resumo + fórmula atualizada.

- [x] Definir regra: Outras Receitas entram como receita bruta (card separado nos cards de resumo)
- [x] Implementar exibição de Outras Receitas na seção de Receitas do Fechamento (card de resumo)
- [x] Garantir que o total do Resultado Líquido inclua Outras Receitas (Faturamento - CMV - Despesas + Outras Receitas)
- [ ] Entender se há conceito de "parcela de juros" em Outras Receitas (ex: empréstimo com juros) — pendente definição

#### 6. Estoque por Categoria — Congelar Valor Final do Mês Fechado ✅ (03/03/2026)
**Implementado:** Snapshot automático via node-cron no último dia do mês às 23:59 SP.

- [x] Criar tabela `monthlyStockSnapshot` (companyId, categoryId, month, closingValue, closingQuantity, savedAt)
- [x] Implementar job automático (node-cron) que salva o snapshot no último dia do mês
- [x] Alterar query de Estoque por Categoria no Fechamento para usar snapshot quando mês já fechado
- [x] Alterar query de Evolução Mensal do Estoque para usar snapshot de meses passados
- [x] Garantir que o mês atual ainda use o valor em tempo real
- [x] Snapshots retroativos capturados para Jan/2026 e Fev/2026

#### 7. Correção de Datas de Vendas (Planilha Enviada)
**Vendas a corrigir para 31/01/2026:**

| ID Venda | Pedido | Data Correta |
|----------|--------|--------------|
| 46950069 | 385 | 31/01/2026 |
| 46950047 | 1001 | 31/01/2026 |
| 46950051 | 1539 | 31/01/2026 |
| 46950030 | 2335 | 31/01/2026 |
| 46950052 | 2758 | 31/01/2026 |
| 46950037 | 4723 | 31/01/2026 |
| 46950068 | 5456 | 31/01/2026 |
| 46950050 | 6691 | 31/01/2026 |
| 46950048 | 6755 | 31/01/2026 |
| 46950036 | 6787 | 31/01/2026 |
| 46950049 | 6843 | 31/01/2026 |
| 58230008 | 2191 | 22/02/2026 |
| 58230007 | 9841 | 27/02/2026 |

- [x] Executar UPDATE nas vendas acima com as datas corretas (11 vendas → 31/01/2026; 58230008 → 22/02/2026; 58230007 → 27/02/2026)
- [ ] Verificar impacto contábil (journals associados a essas vendas)
- [ ] Reprocessar lançamentos contábeis das vendas corrigidas se necessário

#### 8. Corrigir Impresso de Documento — Bobina 80mm
**Problema:** Layout do comprovante impresso não está adequado para bobina térmica de 80mm.

- [ ] Revisar CSS de impressão (media print) para largura 80mm
- [ ] Ajustar fontes, margens e quebras de linha para bobina térmica
- [ ] Testar impressão em impressora térmica real ou emulador

#### 9. Paginação/Lazy Load em Listas de Despesas e Receitas
**Sugestão:** Em vez de carregar todos os registros, trazer apenas os últimos N e usar filtros para buscar mais.

- [ ] Implementar paginação ou "carregar mais" nas listas de Despesas
- [ ] Implementar paginação ou "carregar mais" nas listas de Outras Receitas
- [ ] Definir quantidade padrão de registros iniciais (sugestão: últimos 30)
- [ ] Garantir que filtros de período/busca funcionem sobre o conjunto completo

#### 10. Modal de Registro de Pagamento — Campo Banco
**Sugestão:** Adicionar campo de banco/conta no modal de registro de pagamento.

- [ ] Adicionar campo "Banco/Conta" no modal de registro de pagamento (Contas a Pagar e Contas a Receber)
- [ ] Popular com as contas bancárias cadastradas no módulo de Contabilidade
- [ ] Salvar banco/conta no registro de pagamento para rastreabilidade
- [ ] Revisar campo "Forma de Pagamento" no mesmo modal (entender se está correto ou precisa de ajuste)

#### BUG: Análise de Despesas — Nenhuma despesa encontrada após mudança de lógica ✅
**Problema:** Após migrar para `expenseInstallments.dueDate`, despesas sem parcelas na tabela (ex: pagamento à vista sem registro em expenseInstallments) não aparecem mais.
- [x] Investigar se despesas à vista têm registros em expenseInstallments (todas têm)
- [x] Corrigir query: bug era coluna inexistente `e.installments`
- [x] Garantir que DAS (Simples Nacional) aparece em Janeiro no Fechamento (corrigido via competenceMonth)

#### BUG: DAS Simples Nacional — Aparece em Fevereiro no Fechamento ✅
**Problema:** O DAS ID 1170001 tem competenceMonth=2026-01 mas ainda aparece em Fevereiro no Fechamento.
- [x] Verificar dueDate das parcelas do DAS na tabela expenseInstallments (dueDate=20/02/2026)
- [x] Corrigido: query de Fechamento usa competenceMonth em vez de dueDate

#### NOVO: Card de Outras Receitas no Fechamento ✅
**Escopo:** Criar seção/card no Fechamento que exibe Outras Receitas (otherRevenues) + Lançamentos Extras do Contas a Receber do mês selecionado.
- [x] Criar query getOtherRevenuesByMonth no db.ts (inline no getMonthlyClosing)
- [x] Adicionar ao getMonthlyClosing os dados de Outras Receitas
- [x] Criar card visual no frontend do Fechamento com total e lista de lançamentos
- [x] Incluir Outras Receitas no cálculo do Resultado Líquido

#### NOVO: Snapshot de Estoque Mensal (Congelar Valor Final) ✅
**Escopo:** Criar tabela monthlyStockSnapshot e job de fechamento para congelar estoque final.
- [x] Criar tabela monthlyStockSnapshot no banco (via SQL direto)
- [x] Criar funções captureMonthlyStockSnapshot e getMonthlyStockSnapshot
- [x] Implementar job automático (node-cron) no último dia do mês às 23:59 SP
- [x] Alterar query de Estoque por Categoria no Fechamento para usar snapshot quando mês já fechado
- [x] Integrar snapshot na Evolução Mensal de Estoque
- [x] Executar snapshot retroativo para Jan/2026 e Fev/2026


---

## ✅ CORREÇÕES EXECUTADAS EM 03/03/2026

### Bug: Análise de Despesas - Nenhuma despesa encontrada
- [x] Causa: coluna inexistente `e.installments` na query `getExpenseHierarchicalData`
- [x] Correção: removida referência a `e.installments` (coluna não existe na tabela `expenses`)
- [x] Resultado: análise hierárquica retorna 88 parcelas corretamente

### Bug: DAS no Fechamento aparecia em Fevereiro
- [x] Causa: query de Fechamento usava `ei.dueDate` (vencimento = 20/02), mas DAS tem competência em Janeiro
- [x] Correção: query de Fechamento agora usa `e.competenceMonth` para agrupar despesas
- [x] Resultado: DAS (R$2.396,17) aparece corretamente em Janeiro no Fechamento

### Card de Outras Receitas no Fechamento
- [x] Adicionada query de `otherRevenues` ao `getMonthlyClosing`
- [x] Card verde (border-t-emerald-500) exibido após Despesas por Conta Gerencial
- [x] Mostra: descrição, parceiro, conta gerencial, valor por lançamento + total
- [x] Visível apenas quando há lançamentos no período

### Snapshot de Estoque Mensal (Congelar Estoque Final)
- [x] Criada tabela `monthlyStockSnapshot` no banco (via SQL direto)
- [x] Adicionada ao schema.ts para rastreabilidade
- [x] Funções `captureMonthlyStockSnapshot` e `getMonthlyStockSnapshot` em `closingQueries.ts`
- [x] Endpoints: `closing.captureStockSnapshot` (mutation, admin) e `closing.getStockSnapshot` (query, consultor)
- [x] Botão "Fechar Mês" no header do Fechamento (visível apenas para admin)
- [x] Badge "Estoque Congelado" / "Estoque em Tempo Real" no card de Estoque por Categoria
- [x] Integrar snapshot na query `getStockByCategory` para usar valores congelados quando disponível


### BUG: Lançamentos duplicados na Análise de Despesas (03/03/2026)
- [x] Investigar causa da duplicação — parcelas duplicadas no banco (erro de digitação, 2 parcelas para mesma despesa)
- [x] Excluídas 5 parcelas duplicadas (Pró-Labore R$3.500 x2 e 3 outras)
- [x] Não era bug de query, era dado duplicado na tabela expenseInstallments

### Snapshot de Estoque Automático (03/03/2026)
- [x] Remover botão manual "Fechar Mês" do Fechamento
- [x] Implementar job automático (node-cron) para capturar estoque no último minuto do último dia do mês (23:59 SP)
- [x] Integrar snapshot nas queries de Fechamento (getStockByCategory) e Análise de Estoque (Evolução Mensal)
- [x] Quando snapshot existe para o mês, usar valores congelados; caso contrário, usar estoque em tempo real
- [x] Snapshots retroativos capturados para Jan/2026 e Fev/2026

### Outras Receitas no DRE Contábil (03/03/2026) ✅
- [x] Incluir Outras Receitas no cálculo do DRE contábil (accounting.ts — seção 7 OUTRAS RECEITAS)
- [x] resultadoLiquido = lucroOperacional + totalOutrasReceitas
- [x] Filtro para não duplicar receitas já contabilizadas (isAccounted = 0)
- [x] Não mexer na contabilização por enquanto (pendente análise do responsável)


### Sprint 03/03/2026 - Ajustes de Interface e Lógica
- [x] Simplificar card Outras Receitas no Fechamento (apenas total + descrição resumida)
- [x] Remover badge "Estoque Congelado" do header do Fechamento (manter lógica funcional)
- [x] Corrigir Contabilidade 12/2025 aparecendo em Janeiro na Análise de Despesas (competência Dez, dueDate Jan)
- [x] Corrigir DAS R$0,00 na Análise de Despesas de Janeiro (competência Jan, dueDate Fev)

### Regra Híbrida de Despesas na Análise e Fechamento (03/03/2026)
- [x] Parcelado (>1 parcela): valor da parcela no mês do dueDate (vencimento)
- [x] Pagamento único (1 parcela): valor no mês do competenceMonth (competência)
- [x] Contabilização: tudo pelo competenceMonth (regime de competência contábil padrão)
- [x] Atualizar getExpenseHierarchicalData com regra híbrida
- [x] Atualizar getExpenseAnalysisByCategory, byMonth, byCategoryAndMonth, summary, detail
- [x] Atualizar queries de despesas no getMonthlyClosing (Fechamento) - seções 3 e 7
- [x] 10 testes vitest passando (expense-hybrid-rule.test.ts)

### Outras Receitas no Resultado Líquido do Fechamento (03/03/2026)
- [x] Mover card de Outras Receitas para acima do card de Resultado Líquido
- [x] Incluir Outras Receitas no cálculo do Resultado Líquido (Faturamento - CMV - Despesas + Outras Receitas)
- [x] Ajustar backend (getMonthlyClosing) para somar Outras Receitas ao resultado
- [x] Ajustar frontend (FechamentoMensalNovo) para posicionar card corretamente
- [x] Detalhamento de Outras Receitas com tabela (Descrição, Parceiro, Conta Gerencial, Valor) — removido a pedido do Gabriel
- [x] Removida seção 7 de detalhamento (não precisa desse nível de detalhe no fechamento)
- [x] 8 testes vitest passando (other-revenues-result.test.ts)

---

## 📋 RESUMO CONSOLIDADO - Sprint 03/03/2026

### Entregas do dia:

**1. Lançamentos duplicados na Análise de Despesas**
- Investigado e resolvido: eram parcelas duplicadas no banco (erro de digitação), não bug de query
- Excluídas 5 parcelas duplicadas

**2. Snapshot de Estoque Automático**
- Removido botão manual "Fechar Mês"
- Implementado job automático (node-cron) para capturar estoque no último minuto do mês (23:59 SP)
- Snapshots retroativos capturados para Jan/2026 e Fev/2026

**3. Outras Receitas no DRE**
- Incluídas no cálculo do DRE na conta gerencial lançada (seção 7)
- Filtro para não duplicar receitas já contabilizadas

**4. Ajustes de Interface**
- Simplificado card Outras Receitas no Fechamento
- Removido badge "Estoque Congelado" do header

**5. Regra Híbrida de Despesas (Análise + Fechamento)**
- Parceladas (>1 parcela): valor da parcela no mês do vencimento (dueDate)
- Pagamento único (1 parcela): valor no mês de competência (competenceMonth)
- 8 funções atualizadas (6 análise + 2 fechamento)
- Corrigido: DAS aparece em Janeiro (competência Jan), Contabilidade 12/2025 voltou para Dezembro

**6. Outras Receitas no Resultado Líquido**
- Card de Outras Receitas adicionado nos cards de resumo (5 colunas)
- Fórmula: Resultado = Faturamento - CMV - Despesas + Outras Receitas
- Empréstimo Pronampe (R$121.480,34) agora compõe o resultado de Janeiro

### Pendências remanescentes (próximas sprints):
- [x] Incluir Outras Receitas no DRE contábil (dre.resultadoLiquido) — já implementado em accounting.ts (seção 7)
- [x] Comparativo mês anterior (previousMonth.netResult) incluir Outras Receitas — já usa getMonthlyClosing recursivo que calcula netResult com Outras Receitas
- [ ] Impressão do Fechamento: logo da empresa + layout A4
- [x] Fase 2 Timezone: migrar exibição (PDF/backup) — concluído 25/02
- [x] Fase 3 Timezone: manter timestamps técnicos em UTC — concluído 25/02
- [x] Acesso por Empresa: Fases 3-5 (parcelas, contabilidade, testes) — concluído 25/02
- [x] Pedidos cancelados iFood: não aparecer na lista (já implementado — CANCELLED/DECLINED filtrados em ifoodImport.ts)
- [x] Campo Data iFood: usar inicio_da_entrega (já implementado — ifoodImport.ts linha 370)

---

## Sprint 03/03/2026 — Melhorias Operacionais (Lote 2)

### 1. Paginação em Despesas e Outras Receitas ✅
- [x] Backend: adicionar page/limit à query getExpenses (db.ts)
- [x] Backend: adicionar page/limit à query listOtherRevenues (accounting.ts)
- [x] Backend: retornar { data, total, totalPages, page }
- [x] Router: adicionar page/limit ao input das procedures expenses.list e listOtherRevenues
- [x] Frontend Despesas: controles de paginação (botões de página, indicador "Página X de N")
- [x] Frontend Outras Receitas: controles de paginação (mesma UX)
- [x] Filtros resetam página para 1 automaticamente
- [x] Cards de resumo usam totais gerais (não apenas da página atual)
- [x] 10 testes vitest passando (pagination.test.ts)

### 2. Contas Bancárias + Campo Banco no Pagamento ✅
- [x] Editar contas bancárias existentes: Adega (Caixa Geral, Itaú, Inter, C6) e A Brasa (Caixa Geral, Itaú)
- [x] Renomear Santander→Inter, Bradesco→C6, desativar BB
- [x] Criar contas para A Brasa (Caixa Geral + Itaú)
- [x] Adicionar campo bankAccountId nas tabelas de parcelas + customerPayments + receivablePayments
- [x] Criar endpoint getBankAccounts (filtrar contas 1.1.1.* ativas por empresa)
- [x] Adicionar dropdown Banco/Conta no modal de pagamento (Contas a Pagar)
- [x] Adicionar dropdown Banco/Conta no modal de pagamento (Contas a Receber antigo + novo)
- [x] Passar bankAccountId nas 5 mutations de pagamento (routers.ts)
- [x] 10 testes vitest passando (bank-accounts.test.ts)

### 3. Impressão do Fechamento em A4
- [ ] Layout de impressão A4 com logo da empresa ativa
- [ ] Formatação profissional para apresentar a sócios/contador
- [ ] CSS @media print com todas as seções do Fechamento
- [ ] Logo dinâmico por empresa (Adega Beira Rio / A Brasa)

### 4. Redesign da Tela de Metas
- [x] Redesenhar com hierarquia visual (gauge/barra de progresso estilizada)
- [x] Ícones por departamento/canal (ex: ícone iFood, Balcão, Delivery, etc.)
- [x] Comparativo mês a mês (meta vs realizado dos últimos 3 meses)
- [x] Destaque visual para metas atingidas (verde) vs atrasadas (vermelho)

### Correções do dia
- [x] Compra duplicada #3960002 (Comercial Bolsão R$237,63) — já resolvida anteriormente
- [x] Desconsiderar total de compras no período (já tem no Fechamento)

### Correção Banco/Conta no Pagamento (03/03/2026) ✅
- [x] Dropdown Banco/Conta já existia no ContasPagar.tsx (verificado no código)
- [x] Regra inteligente: Dinheiro → Caixa Geral automático (campo desabilitado, visual limpo)
- [x] Regra inteligente: PIX/Transferência/Cartão → Dropdown com contas bancárias (sem Caixa Geral)
- [x] Aplicar regra em ContasPagar.tsx
- [x] Aplicar regra em ContasReceber.tsx
- [x] Aplicar regra em ContasReceberNovo.tsx
- [x] 10 testes vitest passando (bank-smart-rule.test.ts)

### BUG: Dropdown Banco/Conta não aparece no Contas a Pagar (03/03/2026) ✅
- [x] Modal de pagamento do ContasPagar.tsx (parcela individual) — já tinha o campo, layout corrigido
- [x] CalendarPayButton.tsx (botão "Pagar" no calendário de vencimentos) — era o modal que faltava!
- [x] Adicionado query getBankAccounts + regra inteligente (Dinheiro=Caixa Geral, PIX/Transferência=escolher conta)
- [x] bankAccountId passado na mutation payInstallment
- [x] Contas a Receber já funcionava corretamente (referência)

### BUG-FIX: CalendarPayButton - Dropdown Banco/Conta invisível (03/03/2026) ✅
- [x] Corrigido nome da rota tRPC: `getBankAccounts` → `bankAccounts` (rota inexistente retornava 404)
- [x] Corrigido import: `useAuth()` não exporta `activeCompanyId` → trocado para `useCompany()`
- [x] Resultado: dropdown Banco/Conta agora aparece corretamente com opções Itaú, Inter, C6

### Redesign Tela de Metas (03/03/2026) ✅
- [x] Gauge circular SVG com cores por status (verde/amarelo/vermelho)
- [x] Barra de tempo do mês (dia atual, dias restantes)
- [x] Ícones por canal (Truck iFood, Store Balcão, Target Geral)
- [x] Barras de cor no topo dos cards (gradiente por canal)
- [x] Indicadores inteligentes (valor/dia necessário, tendência on/off track)
- [x] Comparativo últimos 3 meses com badges coloridos por status
- [x] Cards de metas do ano organizados por mês com cores por canal
- [x] Histórico com ícones de tendência (verde aumento, vermelho redução)
- [x] Removido aspecto "branco demais" — backgrounds, gradientes, sombras

### Ajustes Metas (03/03/2026)
- [x] Excluir meta "Geral" de Janeiro (inflava análise de R$85.9k para R$145k) — id 60001 removido do banco
- [x] Substituir ícone de caminhão pelo logo do iFood na tela de Metas

### Ajustes Visuais Metas - Ícones (03/03/2026)
- [x] Aumentar tamanho dos ícones de canal na tela de Metas (h-4 w-4 → h-6 w-6)
- [x] Cadastrar logo do 99Food para uso futuro (quando começarem as vendas) — CDN + ChannelIcon + channelColors preparados

### Melhorias Metas - Excluir e Observações (03/03/2026)
- [x] Adicionar botão de excluir meta (para não precisar excluir direto no banco) — com AlertDialog de confirmação
- [x] Corrigir exibição das observações ao criar meta (notes já aparece corretamente após redesign)

### Ordenação em Análises (03/03/2026)
- [x] Adicionar ordenação (maior/menor) na aba Análise de Produto (matriz produto×mês) — colunas meses e Total
- [x] Adicionar ordenação (maior/menor) na Análise Delivery — colunas Qtd, Faturamento, Custo, Margens, Lucro

### Impressões - Sprint 04/03/2026
- [x] Corrigir impressão do documento de venda para bobina térmica 80mm (largura 80mm, Courier New, logo empresa)
- [x] Implementar impressão do Fechamento em A4 com logo da empresa (cabeçalho com logo, nome, CNPJ, rodapé, cores preservadas)

### Correções Impressão - Sprint 04/03/2026 (v2)
- [x] Fechamento A4: reduzir espaçamentos entre colunas das tabelas (table-layout: auto em vez de fixed)
- [x] Comprovante Venda 80mm: texto cortado na lateral (largura reduzida para 72mm, margens 4mm, fontes menores)

### Módulo Auditoria - Histórico de Preços (04/03/2026)
- [x] Analisar estrutura atual de preços e logs no banco de dados
- [x] Criar/verificar tabela de histórico de preços (priceHistory)
- [x] Implementar queries de consulta de histórico de preços no backend (getRecentPriceHistory, getPriceHistoryStats, logPriceChange)
- [x] Criar tela de Histórico de Preços no frontend (filtros por produto, canal, tipo)
- [x] Implementar tracking automático de preço de venda (rota setPrice)
- [x] Implementar tracking automático de custo médio (rota updateProduct)
- [x] Submenu "Auditoria" na sidebar com link para Histórico de Preços
- [x] Paginação, ordenação e filtros funcionando
- [x] Tab "Mais Alterados" com ranking de produtos
- [x] 28 testes unitários passando
- [ ] Exibir gráfico de evolução de preço por produto (futuro)
- [ ] Integrar com tela de detalhes do produto (futuro)

### Expansão Tracking Histórico de Preços (05/03/2026)
- [x] Registrar alteração de custo médio na confirmação de compra (confirmPurchaseOrder) - "Alterado por" mostra "Compra #NF"
- [x] Registrar alteração de custo médio na edição de compra confirmada - "Alterado por" mostra "Edição Compra #NF"
- [x] Registrar alteração de preço de venda via botão de divergência do importador iFood - "Alterado por" mostra "iFood Divergência (usuário)"

### Filtro de Período - Histórico de Preços (05/03/2026)
- [x] Adicionar filtro de data início/fim na tela de Histórico de Preços
- [x] Passar parâmetros de período para a query backend

### Módulo Auditoria - Log de Alterações de Cadastro (05/03/2026)
- [x] Criar tabela auditLog no schema (entityType, entityId, entityName, action, changes JSON, userId, userName)
- [x] Implementar função genérica de logging de alterações no backend (createAuditLog, getAuditLogs, getAuditStats, diffChanges)
- [x] Interceptar alterações de cadastro de produtos (criação, edição, ativação/desativação)
- [x] Criar tela de Log de Alterações no frontend (filtros por entidade, ação, período, busca)
- [x] Tab "Resumo" com estatísticas por tipo e usuários mais ativos
- [x] Dialog de detalhes mostrando campos alterados (antes/depois)
- [x] Adicionar link no submenu Auditoria
- [x] 25 testes unitários passando

### Expansão Módulo Auditoria (06/03/2026)
- [x] Corrigir registro de retorno de estoque por cancelamento de venda (ESTORNO registrado em cancelSale)
- [x] Corrigir registro de retorno de estoque por cancelamento de compra (ESTORNO registrado em cancelPurchaseOrder)
- [x] Expandir auditoria de cadastro para Parceiros (criação/edição com diff de campos)
- [x] Expandir auditoria de cadastro para Categorias (criação/edição/ativação/desativação)
- [x] Expandir auditoria de cadastro para Subcategorias (criação/edição/ativação/desativação)
- [x] Criar tela de auditoria de movimentações de estoque (entradas, saídas, estornos, perdas, acertos)
- [x] Cards de resumo por tipo de movimentação
- [x] Filtros por tipo, produto, período
- [x] Tab "Produtos Mais Movimentados" com ranking top 10
- [x] Link "Mov. Estoque" no submenu Auditoria
- [x] 19 testes unitários passando (stock-movements-audit)

### Auditoria de Acertos Manuais de Estoque (06/03/2026)
- [x] Registrar acerto manual de estoque no auditLog (estoque anterior, novo estoque, quantidade ajustada, justificativa, usuário)

### Segmentação Cards Histórico de Preços (06/03/2026)
- [x] Segmentar cards de resumo: separar métricas de Custo Médio e Preço de Venda
- [x] Atualizar backend para retornar estatísticas por tipo (custo vs venda)
- [x] Redesenhar cards no frontend com seções distintas (borda azul = Venda, borda roxa = Custo)

### Melhorias Cards Histórico de Preços (06/03/2026)
- [x] Inverter lógica de cores: Venda (reajuste=verde, redução=vermelho) / Custo (aumento=vermelho, redução=verde)
- [x] Criar card "Saúde da Margem" com diferença em pp entre Reajuste de Venda e Aumento de Custo
- [x] Indicador visual: margem protegida (verde), comprimida (vermelho), estável (cinza)

### Correção Cores Tabela Histórico de Preços (06/03/2026)
- [x] Corrigir lógica de cores na tabela: Custo aumento=vermelho, redução=verde / Venda aumento=verde, redução=vermelho

### Otimização de Desempenho - Telas de Auditoria (06/03/2026)
- [x] Verificar e garantir paginação no backend (LIMIT/OFFSET) - já existia em todas as telas (50 por página)
- [x] Otimizar queries dos cards de resumo - já usam COUNT(*)/SUM() agregados no banco
- [x] Aplicar filtro de período padrão (últimos 30 dias) nas 3 telas de auditoria
- [x] Criar índices nas tabelas: productMovements(companyId,date), priceHistory(companyId,createdAt), auditLog(companyId,createdAt)

### Bugs Reportados - Movimentações de Estoque (06/03/2026)
- [x] BUG: Histórico de Movimentações por produto trazendo movimentações de OUTROS produtos — corrigido: .where() encadeado no Drizzle sobrescrevia filtro de productId, trocado para and() com array de condições
- [x] BUG: Edição de compra confirmada não registrava movimentação de estorno — corrigido: adicionado createProductMovement (ESTORNO + re-ENTRADA) em updatePurchaseOrderItems

### Melhorias e Correções (07/03/2026)
- [x] Aumentar modal de Histórico de Movimentações do produto para melhor visualização
- [x] BUG: Tela de Auditoria de Movimentações de Estoque não mostra registros retroativos — corrigido: endDate era parseado como meia-noite UTC, excluindo registros do mesmo dia. Aplicado setHours(23,59,59,999) em todas as funções de auditoria
- [x] Permitir produtos inativos na Análise de Vendas e Análise por Canal (para consulta de histórico), mas manter bloqueio na tela de Vendas (activeOnly: true)
- [x] BUG: Auditoria de Movimentações de Estoque — corrigido: setHours(23,59,59) era timezone-dependent (servidor UTC-5), trocado para nextDay UTC + lt() em todas as funções
- [x] BUG: Filtro de busca por produto na Auditoria de Movimentações — verificado: funciona corretamente após restart do servidor
- [x] Implementar debounce (300ms) no filtro de busca em 7 telas: Mov. Estoque, Histórico de Preços, Log de Alterações, Contas Gerenciais, Plano de Contas, Análise Delivery, Contas a Receber
- [x] BUG: Importador iFood edita preço duas vezes — corrigido: updateChannelPrice agora verifica se preço já está atualizado antes de gravar, evitando duplicação no histórico de preços
- [x] Implementar tratamento de outliers nas estatísticas do Histórico de Preços — variações > ±200% excluídas das médias, com indicador visual âmbar nos cards e nas linhas da tabela

## Módulo de Atendimento de Salão — A Brasa Reúne (Fase 1)

### Schema e Backend
- [x] Adicionar campos `productionDestination` (KITCHEN/BAR/BOTH/NONE) e `availableInSalon` ao schema de produtos
- [x] Criar tabela `salonTables` (mesas: id, companyId, number, name, capacity, status, positionX, positionY)
- [x] Criar tabela `salonOrders` (comandas: id, companyId, tableId, waiterId, guestCount, status, openedAt, closedAt, totalAmount, tipAmount, tipPercent)
- [x] Criar tabela `salonOrderItems` (itens da comanda: id, orderId, productId, quantity, unitPrice, notes, productionDestination, status, sentAt, readyAt)
- [x] Criar tabela `salonOrderPayments` (pagamentos: id, orderId, method, amount, createdAt)
- [x] Criar tabela `salonConfig` (configurações: companyId, defaultTipPercent, tipEnabled, gratuityLabel)
- [x] Tabelas criadas via SQL direto (drizzle-kit com prompts interativos)
- [x] Backend: router `salon` com todos os procedures (mesas, comandas, KDS, config, gorjeta, dashboard)
- [x] Integração: ao fechar comanda, baixar estoque e registrar venda no financeiro

### Frontend
- [x] Adicionar campos de salão no cadastro de produto (condicional ao segmento Hamburgueria)
- [x] Tela: SalaoMesas — planta visual de mesas com status colorido, abertura/encerramento de comanda
- [x] Tela: SalaoComanda — lançamento de pedidos, cardápio, itens, encerramento com gorjeta e divisão
- [x] Tela: SalaoKDSCozinha — fila de produção em tempo real (atualização a cada 15s)
- [x] Tela: SalaoKDSBar — fila de produção em tempo real (atualização a cada 15s)
- [x] Tela: SalaoGorjeta — relatório de gorjeta e comissão por garçom
- [x] Menu lateral: seção "Salão" condicional ao segmento Hamburgueria
- [x] Dashboard: cards de Mesas Ocupadas, Faturamento Salão Hoje, Ticket Médio (condicional Hamburgueria)

### Análises
- [x] Vendas do salão aparecem com canal "SALÃO" na Análise de Vendas
- [x] Relatório de gorjeta por garçom (acumulado mensal) — tela SalaoGorjeta

### Bugs Pós-Entrega Fase 1 (07/03/2026)
- [x] BUG: Campos de salão (Destino de Produção + Disponível no Salão) não salvavam — corrigido: campos não estavam no schema Zod do backend (updateProduct)
- [x] BUG: Menu lateral sumia nas telas de Salão — corrigido: todas as 5 páginas agora usam DashboardLayout
- [x] BUG: Busca de produtos na comanda retornava vazio — corrigido: filtro aceita null (não configurado) além de true; addItem também corrigido

### Bugs Pós-Entrega Fase 1 — Rodada 2 (07/03/2026)
- [x] BUG: Busca de produtos na comanda ainda retornava vazio mesmo após configurar produto — corrigido: campo `availableInSalon` tem `.default(false).notNull()` no schema, então produtos antigos têm valor `false` (não `null`). Implementado fallback: se nenhum produto estiver marcado, mostra todos os ativos; quando pelo menos 1 estiver marcado, filtra apenas os marcados
- [x] BUG: KDS Cozinha e KDS Bar ficavam com tela branca — corrigido: nome do procedure no backend era `getKdsItems` (minúsculo) mas frontend chamava `getKDSItems` (maiúsculo). Renomeado para `getKDSItems` no backend
- [x] BUG: KDS ficava branco durante loading — corrigido: estado de loading agora renderiza dentro do DashboardLayout (sidebar visível durante carregamento)
- [x] Adicionado `companyId` opcional ao input de `updateItemStatus` para compatibilidade com frontend

### Bugs Pós-Entrega Fase 1 — Rodada 3 (07/03/2026)
- [x] BUG: Busca de produtos na comanda AINDA retorna vazio — causa raiz: código usava tabela inexistente `channelPrices` (SQL raw) ao invés de `productPrices` (Drizzle schema). A query de preços falhava com erro 500, quebrando toda a resposta. Corrigido: substituída query raw por Drizzle query usando `productPrices` + `salesChannels`, com try-catch para não quebrar listagem se preço falhar. Também corrigido `addItem` que tinha o mesmo problema.

### Melhorias Salão — Rodada 4 (07/03/2026)
- [x] UX: Busca de produtos na comanda — mostrar resultados apenas conforme digita (mínimo 2 caracteres, com loading spinner)
- [x] FEATURE: Notificação ao garçom quando cozinha/bar marca item como "Pronto" — badge pulsante no card da mesa + banner verde na comanda + toast com som + destaque verde nos itens prontos
- [x] UX: Remover card "Faturamento Hoje" da tela de mesas do Salão (já existe no Dashboard)

### Melhorias Salão — Rodada 5 (07/03/2026)
- [x] FEATURE: Botão "Marcar como Entregue" na comanda para itens com status "Pronto" — botão verde com ícone CheckCircle2, chama updateItemStatus(DELIVERED), invalida queries
- [x] UX: Melhorar alerta sonoro de notificação — Web Audio API com chime ascendente (C5-E5-G5), 3x repetição para urgência, funciona em mobile
- [x] PLANEJAMENTO: Sistema de roles para garçom (acesso restrito ao módulo Salão via navegador mobile) — implementado na Rodada 6

### Melhorias Salão — Rodada 6 (07/03/2026)
- [x] FEATURE: Sistema de Garçom — role "garcom" no schema (users + userCompanies), cadastro via Gerenciar Acessos
- [x] FEATURE: Acesso restrito para garçom — DashboardLayout filtra menus, só mostra Salão (Mesas, KDS Cozinha, KDS Bar, Garçons)
- [x] FEATURE: Rastreamento de garçom por comanda — waiterId já registrado em salonOrders, tela de garçons mostra estatísticas
- [x] FEATURE: Canal de venda "SALAO" — adicionado em schema, db.ts, routers.ts, formatters.ts, todas as telas de análise e filtros
- [x] FEATURE: Observações por item na comanda — campo notes já existia no schema, KDS agora exibe com destaque amarelo
- [x] FEATURE: Tela de gestão de garçons — página SalaoGarcons com listagem, estatísticas e link para Gerenciar Acessos

### Bugs Pós-Entrega Rodada 6 (07/03/2026)
- [x] BUG: Som de notificação não toca no iOS/mobile — adicionado botão "Ativar Sons" na tela de mesas; ao tocar, desbloqueia o AudioContext do iOS com buffer silencioso e toca som de confirmação; botão muda para "Sons Ativos" após ativação
- [x] BUG: Dashboard de garçons mostra zerado mesmo após comandas fechadas — causa raiz: problema de timezone. Comandas fechadas após 21h BRT (= 00h UTC do dia seguinte) ficavam fora do range. Corrigido: backend usa 'T00:00:00-03:00' e 'T23:59:59-03:00'; frontend usa toLocaleDateString com timeZone America/Sao_Paulo

### Bugs Pós-Entrega Rodada 7 (07/03/2026)
- [x] BUG: Som não toca após desbloqueio iOS — corrigido com soundEnabledRef (useRef) para evitar stale closure no useEffect de polling
- [x] BUG: Notificação quando tela bloqueada — implementado pushNotification.ts com Web Push API; botão 'Ativar Alertas' solicita permissão de som + push juntos; notificação nativa enviada com requireInteraction=true (fica na tela até o usuário tocar)
- [x] BUG: Dashboard de garçons zerado — confirmado que é comportamento correto: comandas foram fechadas na madrugada do dia 08/03 BRT (após meia-noite), portanto aparecem no dashboard do dia 08/03. Sistema funcionando corretamente com timezone.

### Bugs Pós-Entrega Rodada 8 (07/03/2026)
- [x] BUG: Estado do botão 'Ativar Alertas' reseta ao navegar para comanda e voltar — corrigido: useState inicializa do localStorage, visibilitychange re-sincroniza ao voltar para a página
- [x] BUG: Som não toca mesmo após ativar — corrigido: playNotificationSound agora é async e chama ensureAudioContext() que faz resume() automático; SalaoComanda também verifica getSoundEnabledFromStorage() antes de tocar
- [x] BUG: Notificação push não chega no iOS Safari — documentado: iOS Safari requer PWA (Add to Home Screen) para Web Push; botão 'Alertas Ativos' agora é clicavel para reativar o som após navegação; estado persiste no localStorage

### PWA + Push Notifications iOS (08/03/2026)
- [x] Criar manifest.json com name, short_name, icons, display=standalone, theme_color
- [x] Adicionar meta tags PWA no index.html (apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style, theme-color)
- [x] Criar Service Worker (sw.js) com push event handler para notificações nativas iOS PWA
- [x] Registrar Service Worker no index.html (script inline no body)
- [x] Atualizar pushNotification.ts para usar swReg.showNotification() com fallback para new Notification()

### Vibração Android (08/03/2026)
- [x] Adicionar navigator.vibrate() no notificationSound.ts como alerta tátil junto com o som
- [x] Vibrar na tela de mesas (SalaoMesas) quando novos itens ficam prontos
- [x] Vibrar na tela da comanda (SalaoComanda) quando item fica pronto

### Bugs Pós-Entrega Rodada 9 (08/03/2026)
- [x] BUG: Som e vibração não disparam — corrigido: useRef(-1) como sentinel para primeira carga; dispara alerta sempre que readyItems aumentar após o baseline inicial; mesmo fix aplicado em SalaoComanda; handleEnableSound agora envia notificação de teste + vibração ao ativar

### Bugs Pós-Entrega Rodada 10 (08/03/2026)
- [x] BUG: Som não toca no iOS durante polling — reescrito: substituiu Web Audio API oscillator por HTMLAudioElement com WAV base64 pré-gerado; elemento é "blessed" (play muted) durante gesto do usuário e reutilizado no polling via currentTime=0 + play()
- [x] Adicionado botão "Testar Som Agora" no debug banner (removido junto com banner)

### Web Push Server-Side (08/03/2026)
- [x] Instalar web-push library no servidor
- [x] Gerar VAPID keys e salvar como secrets do projeto
- [x] Criar tabela pushSubscriptions no schema (endpoint, keys, userId, companyId, createdAt)
- [x] Criar endpoints tRPC: pushSubscribe, pushUnsubscribe, pushTest no salon router
- [x] Criar server/webPush.ts com savePushSubscription, removePushSubscription, sendPushToCompany
- [x] Integrar push no updateItemStatus do KDS — disparar push quando item fica READY (com auto-fetch companyId)
- [x] Atualizar sw.js para receber push events do servidor com vibrate e navigation
- [x] Atualizar pushNotification.ts com subscribeToPush() e unsubscribeFromPush() usando VAPID
- [x] Atualizar SalaoMesas.tsx para registrar subscription ao ativar alertas + push test via servidor
- [x] Remover banner de debug após confirmar funcionamento

### Bugs Pós-Entrega Rodada 11 (08/03/2026)
- [x] BUG: Cards do dashboard — corrigido: getDashboardStats usava ctx.user.companyId (inexistente), trocado para ctx.activeCompanyId
- [x] BUG: Cards da tela de garçom — corrigido: getWaiterPerformance usava salonOrders.guests (inexistente), trocado para salonOrders.guestCount
- [x] Remover banner de debug amarelo da tela de mesas
- [x] Reduzir polling para 5s em todas as telas do salão (mesas 15→5s, comanda 10→5s, KDS 8→5s)
- [x] Preparar terreno para Fechamento de Garçom (vendas, produtos e gorjetas por garçom)
- [x] Redesign visual das telas de KDS (cozinha/bar) para ficarem mais atrativas

### Fechamento de Garçom (08/03/2026)
- [x] Backend: endpoint getWaiterClosingReport — relatório detalhado com vendas, itens vendidos, gorjetas, métricas por garçom
- [x] Backend: endpoint getWaiterOrderDetails — incluso dentro do getWaiterClosingReport (orders com items e payments)
- [x] Frontend: tela SalaoFechamentoGarcom com seleção de garçom, período, relatório visual
- [x] Frontend: detalhamento por comanda (itens, valores, gorjeta, tempo de atendimento)
- [x] Frontend: resumo com totais de vendas, gorjetas, ticket médio, produtos mais vendidos
- [x] Adicionar rota /salao/fechamento-garcom no App.tsx e menu lateral

### Redesign Visual KDS (08/03/2026)
- [x] KDS Cozinha: redesign com cards maiores, cores mais vibrantes, timer visual, animações
- [x] KDS Bar: redesign com identidade visual própria (azul/índigo), mesmo padrão de usabilidade
- [x] Botões de ação maiores e mais acessíveis (touch-friendly para tablet) — p-3 com rounded-xl
- [x] Indicador visual de urgência (timer bar + ícone Flame/AlertTriangle + cores progressivas)
- [x] Animação de entrada para novos pedidos (slideInUp com stagger)

### Melhorias Salão v2 (08/03/2026)
- [x] Cards do Salão para cima no dashboard da A Brasa Reúne (movidos para logo após cards principais)
- [x] Remover redundância — Faturamento Salão Hoje já mostra qtd de comandas, Faturamento Diário (calendário) permanece abaixo como visão complementar
- [x] BUG: Garçom duplicado no ranking — NÃO é bug, são 2 usuários distintos (admin + garçom). Revertido agrupamento para waiterId
- [x] Permitir editar mesa (descrição e capacidade) após criação — botão de engrenagem em mesas livres (admin)
- [x] Unificar telas: removidas Garçons e Gorjeta/Garçom do menu, mantido apenas Fechamento Garçom
- [x] Itens sem KDS (destino NONE): marcados direto como DELIVERED ao adicionar na comanda (ex: água)
- [x] Alerta sonoro apenas na tela de Mesas (removido som da comanda, mantido apenas vibração + toast)
- [x] Fluxo de fechamento: pré-visualização/impressão da comanda antes do fechamento efetivo (2 etapas)
- [x] Transfer\u00eancia de comanda entre gar\u00e7ons (al\u00e7ada administrativa)

### Ajustes Comanda e Contabilização (08/03/2026)
- [x] Documento comanda: adicionar campo "Abertura da mesa" (data/hora)
- [x] Documento comanda: adicionar campo "Tempo de permanência"
- [x] Documento comanda: separar Subtotal, Taxa de serviço 10% (opcional), Total com serviço, Total sem serviço
- [x] Documento comanda: adicionar observação "Taxa de serviço (10%) é opcional. Informe ao atendente caso não deseje incluir."
- [x] Separar gorjeta/taxa de serviço do faturamento nos dashboards (subtotal usado para faturamento, tips separados)
- [x] Separar gorjeta/taxa de serviço na contabilização (sale.finalAmount = subtotal, tip registrado em notes)
- [x] Ajustar cards de faturamento do salão para considerar apenas subtotal (sem taxa de serviço)
- [x] Ajustar relatório de fechamento de garçom para separar faturamento vs taxa de serviço
- [x] Adicionar etapa de confirmação da taxa de serviço entre impressão e pagamento (3 etapas: preview → confirma taxa → pagamento)
- [x] Ampliar modal de pré-visualização da comanda (sm:max-w-2xl)
- [x] Adicionar colunas detalhadas nos itens: Item / Qtd / Vlr Unit / Total (tela + impressão)
- [x] Corrigir espaçamento no resumo superior e formato tabular nos itens
- [x] BUG: Divergência faturamento dashboard — corrigido: 6 registros antigos de sales tinham finalAmount=totalAmount (com taxa), agora todos usam subtotal
- [ ] [FUTURO] QR Code no documento de vendas para avaliação/cadastro do cliente (promoções, retorno, consumo individualizado)

### Pré-publicação (08/03/2026)
- [x] Configuração de % taxa de serviço por empresa (modal config em Mesas + comanda usa defaultTipPercent + rótulo dinâmico)
- [x] Detalhar proposta de Pagamento Dividido (documento completo em docs/PROPOSTA-PAGAMENTO-DIVIDIDO-E-ESTUDO-SEFAZ.md)
- [x] Estudo de viabilidade integração SEFAZ para emissão de NFC-e (documento completo em docs/)

### Pagamento Dividido + KDS Melhorias (08/03/2026)
- [x] Pagamento Dividido: tabela salonOrderPayments já existe no schema
- [x] Pagamento Dividido: closeOrder já aceita array de payments + mapPaymentMethod retorna MISTO
- [x] Pagamento Dividido: UI de split payment no checkout (toggle único/dividido, saldo restante visual, botão Restante)
- [x] Pagamento Dividido: validação soma = total (botão desabilitado até completar, excesso bloqueado)
- [x] Pagamento Dividido: contabilização individual já implementada via salonOrderPayments
- [x] Impressão de pedido para KDS (Cozinha/Bar) — ticket de produção imprimível (formato 80mm, popup print)
- [x] KDS tela vazia com métricas operacionais (pedidos hoje, tempo médio, último pedido)
- [x] KDS Análise: aba Análise com tempo médio por item (ranking com barra visual + cards de stats)
- [x] SEFAZ/NFC-e anotado como pendência futura (não prioridade, aguardar reforma tributária)

### Transferência de Comanda (08/03/2026)
- [x] Backend: endpoint transferOrder (orderId, newWaiterId, reason) — admin only
- [x] Backend: registrar log de transferência (from, to, reason, timestamp, adminId) — salvo em notes da comanda
- [x] Frontend: tela administrativa de transferência — visão de garçons com comandas associadas
- [x] Frontend: modal de transferência com seleção de novo garçom + campo obrigatório de motivo
- [x] Adicionar rota /salao/transferencia e menu lateral (admin only)

### Correções pós-publicação (08/03/2026)
- [x] BUG CRÍTICO: Erro "Cannot access 'Ut' before initialization" na tela de comanda — variáveis subtotal/totalWithTip usadas antes de serem definidas (movidas para antes dos handlers)
- [x] BUG: Dashboard Faturamento Salão e Ticket Médio mostrando valores de comandas canceladas — cancelar venda no módulo Vendas agora também cancela a salonOrder correspondente
- [x] BUG: Fechamento Garçom mostrando dados de comandas canceladas — mesma correção acima (salonOrders sincronizadas com sales)
- [x] FIX: Dados históricos corrigidos — 6 salonOrders com vendas canceladas atualizadas para status CANCELLED
- [x] Transferência de Comanda já estava no menu lateral (confirmado funcionando)

### Correções pós-publicação v2 (08/03/2026)
- [x] BUG: Erro ao salvar config do Salão — kitchenLabel e barLabel esperando string mas recebendo undefined (tornados opcionais com defaults)
- [x] Remover seletor de % taxa de serviço da tela de comanda (usar apenas config global)
- [x] BUG: Texto encoding errado em Pagamento Único e outros textos — corrigido em SalaoComanda.tsx e SalaoMesas.tsx
- [x] Confirmado: Cancelar Venda já cancela Comanda automaticamente (não precisa botão separado de estorno)

### Correções pós-publicação v3 (08/03/2026)
- [x] Transferência de Comanda agora usa DashboardLayout com sidebar
- [x] BUG: Impressão de comanda/ticket — CSS ajustado para papel térmico 80mm com @page size auto (comanda, cozinha e bar)
- [x] BUG: Análise KDS não trazia dados — corrigido: usava coluna 'destination' inexistente, trocado para 'productionDestination' + inclui itens BOTH

### Melhorias pós-publicação v4 (08/03/2026)
- [x] Exportar relatório de Fechamento por Garçom (PDF individual com taxa de serviço, produtos vendidos, comandas atendidas)
- [x] Trocar termo "Misto" na forma de pagamento para listar formas usadas (ex: "DINHEIRO + PIX")

### Melhorias pós-publicação v5 (08/03/2026)
- [x] Dashboard: integrar card "Mesas Ocupadas" junto aos demais, remover "Faturamento Salão Hoje" e "Ticket Médio Salão"
- [x] Transição de empresa: redirecionar sempre para /dashboard ao trocar empresa
- [x] Botões "Configurar" e "+Nova Mesa" visíveis apenas para admin
- [x] Responsividade mobile: ajustar telas de Mesas e Comanda
- [x] Mover "Fechamento Garçom" do menu Salão para o menu Análises (visível apenas para Hamburgueria)

### Correções e melhorias pós-publicação v6 (08/03/2026)
- [x] BUG: Cancelar comanda agora cancela itens no KDS automaticamente + dados históricos corrigidos
- [x] Remover item da comanda — já existia (botão lixeira), confirmado funcionando
- [x] Métricas KDS agora desconsideram itens/comandas canceladas (era 23x, agora 3x correto)
- [x] Tela Análise KDS criada no menu Análises com filtro de período, destino (Todos/Cozinha/Bar) e métricas detalhadas

### Melhorias pós-publicação v7 (09/03/2026)
- [x] Adicionar gráfico de horário de pico na Análise KDS (barras por hora mostrando volume de pedidos)

### Correções e melhorias v8 (09/03/2026)
- [x] BUG: Análise de Canal não mostra vendas do Salão (zerado) — vendas SALAO precisam alimentar o canal
- [x] BUG: Análise de Estoque vindo sem dados para Hamburgueria (relaxado filtro currentStock > 0)
- [x] BUG: Fechamento - Faturamento por Tipo de Pagamento mostrando tudo em uma linha (ex: "DINHEIRO + DEBITO + CREDITO + PIX") em vez de separar por tipo
- [x] Investigar timezone KDS Analytics — corrigido para usar getCurrentBrazilDateInfo() no frontend
- [x] Melhoria: Diminuir quantidade de item na comanda (em vez de só remover completamente)

### Funcionalidades v9 (09/03/2026)
- [x] Controle de acesso por horário para Garçom — bloquear acesso fora do horário ou exigir check-in pelo admin
- [x] Contas a Receber — compactar visualização na tela principal (expandir detalhes sob demanda), manter PDF completo com saldo pendente

### Ajustes v9.1 (09/03/2026)
- [x] Garçom: auto-suspender acesso quando horário de fechamento chegar (verificação periódica no frontend)
- [x] Garçom: notificar admin quando garçom tentar acessar e estiver bloqueado (push notification + throttle 10min)
- [x] Contas a Receber: inverter ordem do histórico para mostrar lançamentos mais recentes primeiro

### Funcionalidades v9.2 (09/03/2026)
- [x] Painel de presença dos garçons no Dashboard (check-in/check-out, status ativo/inativo, resumo diário)

### Correções v9.3 (09/03/2026)
- [x] BUG: Garçom com check-in ativo ainda bloqueado fora do horário — check-in do admin deve sobrepor restrição de horário

### Melhorias v9.4 (09/03/2026)
- [x] Redesign tela de bloqueio do garçom com logo da empresa e paleta de cores da marca (A Brasa Reúne: Laranja Brasa, Grafite, Creme Vintage)
- [x] Melhorar fluxo de check-in — botão rápido de liberação no Dashboard (Painel de Presença)

### Reunião Contadora v10 (09/03/2026)
- [x] Ocultar aba/seção "Despesas" dentro da tela de Categorias (conceito substituído por Conta Gerencial)
- [x] BUG: Relatório de vendas trazendo dados fora do range de datas (ex: 01/03-09/03 traz dados de 28/02) — corrigido timezone na exportação
- [x] Compras: adicionar filtro de Tipo de Documento + Status, cards de totais, exportar para Excel
- [x] Permitir cancelamento de dados de teste criados durante desenvolvimento (Receitas, Despesas, Compras) — funcionalidade já existe nas 3 telas
- [x] Exportação de Despesas e Outras Receitas para CSV/Excel
- [x] Replicar acessos de ADM para consultor (apenas leitura) — todas análises, financeiro, contabilidade, categorias, importar iFood
- [ ] FUTURO: Mapeamento de Tempo de Geração de pedido para Bar/Cozinha, Produção e entrega ao cliente (análise operacional)

### Apontamentos v11 (18/03/2026)
- [x] Compras: corrigir formatação numeral nos Cards de Totais (falta pontuação R$1.000,00)
- [x] Compras: exportação analítica implementada (botão 'Excel Analítico' com dados por produto/lançamento)
- [x] Despesas: corrigir formatação numeral na tela de resumo (valores acima de R$1.000 sem pontuação)
- [x] Contas a Receber: remover filtro duplicado (mantido apenas o Popover de busca)
- [x] Contas a Pagar: coluna Data de Pagamento corrigida (status PAID e PAGO tratados)
- [x] Contas a Pagar: validação obrigatória de banco/conta implementada antes de confirmar pagamento
- [x] Contas a Pagar: renomeado para "Baixa de Pagamento" + opções atualizadas (Dinheiro, Pix, Crédito em Conta)

### Apontamentos v12 (18/03/2026)
- [x] Contas a Receber: redesenhar filtro — substituir Popover sobreposto por barra de busca inline (menos poluído)
- [x] A Brasa Reúne: conta gerencial corrigida — filtro por companyId adicionado + contas copiadas para empresa 2
- [x] De/Para iFood: permitir edição do produto associado (alterar mapeamento existente)
- [x] Despesas (Lançamento): removido texto "(Opcional)" ao lado do campo Fornecedor
- [x] Despesas: corrigida lógica de parcelas — botão 'Dividir Igualmente' agora usa soma das parcelas existentes
- [x] Análise de Vendas: mês e ano atual selecionados por padrão + botões Todos/Nenhum para meses
- [x] Análise de Canal: Canal Salão oculto para empresas com segmento 'Adega' (exibido apenas na A Brasa)

### Apontamentos v12 — Complementos (18/03/2026)
- [x] De/Para iFood: permitir edição do produto de destino em mapeamentos existentes (corrigir associações indevidas)
- [ ] FUTURO: Substituição de item em pedido iFood importado — trocar produto entregue sem alterar receita (valor iFood original mantido, baixa de estoque dos produtos reais entregues, campo de observação do motivo)

### Apontamentos v13 (18/03/2026)
- [x] Compras: exportação analítica — encargos agora com rateio proporcional por item (proporção do custo)
- [x] Importador iFood: erro de vinculação corrigido — ifoodProductName null tratado com fallback para SKU
- [x] De/Para iFood: busca agora inclui nome do produto interno (ABRWF) além do nome iFood e SKU
- [ ] Importador iFood: avaliar customização visual para melhorar associação
- [x] Despesas: Observação (notes) exibida na listagem quando preenchida
- [x] Despesas: lógica de edição documentada (admin only, status ATIVA, reprocessa journal contábil)

### Apontamentos v14 (18/03/2026)
- [x] De/Para iFood: busca corrigida — collation utf8mb4_bin causava case-sensitive, agora usa LOWER()
- [x] De/Para iFood: listagem e busca corrigidas — schema Drizzle faltava companyId/branchId (colunas existiam no DB mas não no schema), causando erro 500 "Cannot convert undefined or null to object" no leftJoin com products. Adicionados campos ao schema + products.name incluído no select do leftJoin
- [x] De/Para iFood: busca expandida — inclui todos os produtos ABRWF (não apenas mapeamentos existentes), permitindo mapeamento preventivo e criação de vínculo manual. Produtos sem mapeamento aparecem com badge azul "Sem mapeamento iFood" e botão "Criar Vínculo"
- [x] Importador iFood: customização visual — cores iFood (#EA1D2C vermelho, #50A773 verde), header com ícone iF, tabs com destaque vermelho, badges de status estilizados, cards de resumo com layout iFood, botões de ação em vermelho iFood
- [x] De/Para iFood: paginação real — 50 itens por página, 9 páginas (448 mapeamentos), controles Anterior/Próximo com números de página em vermelho iFood, reset automático ao buscar
- [x] Importador iFood: substituído ícone "iF" pelo logo oficial do iFood (PNG com fundo transparente via CDN)
- [x] De/Para iFood: exportação da tabela de mapeamentos para Excel — botão "Exportar Excel" no De/Para, gera arquivo .xlsx com SKU iFood, Produto iFood, Produto ABRWF, EAN ABRWF e Situação. Exportou 448 mapeamentos com sucesso
- [x] Importador iFood: substituído logo por arquivo oficial enviado pelo Gabriel (JPEG 736x736) — atualizado no Importador iFood e na tela de Metas
- [x] Importador iFood: customização visual na aba Preview — header com bg cinza sutil, contagem de selecionados, botões de ação compactos com cores iFood, hover rows estilizados, botão "Importar" individual em vermelho iFood
- [x] Importador iFood: animação de entrada (splash) com logo iFood ao acessar a tela — overlay com gradiente branco→rosa, logo com bounce entrance, barra de progresso vermelha, glow pulsante, fade-out suave em 2.4s
- [x] BUG: Importação iFood falha com "Invalid input: expected string, received null" no campo ifoodProductName — corrigido schema Zod para aceitar null com default '' e adicionado fallback (item.produto || sku || '') nos processedItems
- [x] Importador iFood: reduzida animação de entrada — removido overlay fullscreen, agora apenas fade-in sutil no header com logo girando levemente e underline vermelho se expandindo sob o título
- [x] Renomear "Importar iFood" para "Importar Vendas" no menu lateral — atualizado sidebar com ícone ShoppingBag e path /importar-vendas, isActive com startsWith para destacar em sub-rotas
- [x] Criar página hub "Importar Vendas" com grid de seleção de importadores — 4 cards (iFood ativo, 99Food/Mercado Livre/Importação Própria em "Em breve"), logos, badges de status, hover effects
- [x] Animação de entrada no grid de seleção — stagger fade-in dos cards com cubic-bezier bounce, transição zoom-out ao clicar no card do iFood antes de navegar
- [x] Ajustar rotas: /importar-vendas (hub) e /importar-vendas/ifood (importador atual) — wouter Switch com rotas ordenadas corretamente
- [x] Importador iFood: botão "Voltar" no header para retornar ao hub Importar Vendas — link com seta ← em cinza, hover em vermelho iFood
- [x] Importador iFood: breadcrumb "← Importar Vendas > iFood" no topo — navegação funcional de volta ao hub, "iFood" em vermelho como página ativa

### Apontamentos v22 (21/03/2026)
- [x] BUG: Análise de Despesas — filtro de ano agora dinâmico: endpoint `availableYears` consulta DISTINCT anos de competenceMonth (parcela única) e dueDate (parceladas), mostrando 2025/2026/2027 automaticamente
- [x] [DISCUSSÃO] Fechamento Anual — criar guia com visão Mês ao Lado de Mês (Jan | Fev | Mar | ... | Dez) consolidando receitas + despesas + resultado. Implementado como DRE Gerencial anual com 4 abas
- [ ] [DISCUSSÃO] Despesas com Imóvel Alugado — avaliar tratamento separado das despesas de ocupação (aluguel, condomínio, IPTU, seguro). Valor alto (R$ 197k) distorce análise das demais despesas operacionais. Possibilidades: seção própria no DRE, rateio por filial, indicador % sobre faturamento

### Apontamentos v23 (01/04/2026)
- [x] A Brasa Reúne: atualizar logo no sistema com versão final enviada pelo Gabriel (fundo preto, selo laranja/carvão com chama) — SVG convertido para PNG (512x512) via cairosvg, CDN atualizado, banco de dados atualizado (id=2). Logo renderizando corretamente (naturalWidth=512, complete=true)
- [x] Tela Selecionar Empresa: logo ABRWF com muito espaçamento no container — removido container com borda/sombra, logo agora exibido limpo com object-contain
- [x] A Brasa Reúne: remover fundo preto do logo, deixar apenas o selo circular com transparência — processado com Pillow, CDN atualizado, DB atualizado

### Apontamentos v28 (04/04/2026)
- [x] Snapshot de Estoque: adicionar campo `snapshotType` (OPENING/CLOSING) para capturar estoque inicial e final do mês
- [x] Snapshot de Estoque: corrigir job para iterar por TODAS as empresas ativas (não apenas companyId=1)
- [x] Snapshot de Estoque: capturar snapshot de ABERTURA no 1º dia do mês (00:05) e FECHAMENTO no último dia (23:55) + safety net dia 2 às 06:00
- [x] Snapshot de Estoque: capturar snapshot de abertura de Abril 2026 para ambas as empresas (baseline) — Co1: 8 categorias R$90.403, Co2: 2 categorias R$16,50
- [x] Snapshot de Estoque: atualizar queries de fechamento e análise para usar snapshots opening/closing — router atualizado com parâmetro snapshotType

### Apontamentos v29 (06/04/2026)
- [x] BUG: Backup automático falha em produção — `mysqldump: not found`. Reescrito: banco exportado via SQL puro (mysql2/promise + SHOW CREATE TABLE + SELECT), código via archiver (Node.js nativo). Testado: 66.62 MB DB + 4.42 MB código, upload S3 OK

### Apontamentos v30 (06/04/2026) — Fechamento Anual
- [x] Fechamento Anual: Backend — queries para agregar dados mensais (receitas, deduções, CMV, despesas operacionais, despesas ocupação, resultado financeiro) por mês/ano/empresa
- [x] Fechamento Anual: Backend — tRPC procedures para DRE anual, estoque mensal, e indicadores
- [x] Fechamento Anual: Frontend — página FechamentoAnual com 5 cards de resumo anual
- [x] Fechamento Anual: Frontend — aba DRE Mês a Mês (tabela Jan→Dez + Total + AV%)
- [x] Fechamento Anual: Frontend — aba Gráficos (barras Receita vs Despesa + linha Margem)
- [x] Fechamento Anual: Frontend — aba Estoque Mensal (Abertura → Fechamento com CMV e Giro)
- [x] Fechamento Anual: Frontend — aba Indicadores (KPIs consolidados)
- [x] Fechamento Anual: Registrar rota e adicionar no sidebar
- [x] Fechamento Anual: Performance — otimizado getYearlyClosing com queries paralelas (lotes de 4) para evitar timeout em empresas com grande volume de dados (Adega Beira Rio 2025)

### Apontamentos v31 (07/04/2026) — Correções Fechamento Anual
- [x] BUG: Faturamento divergente — Corrigido: DRE agora usa tabela `sales` (fonte real) em vez de `revenueEntries` (contabilização incompleta). Delivery estava com R$27.790 em vez de R$91.510
- [x] Vendas Salão — Corrigido: canais de venda agora são dinâmicos, só aparecem se totalVal > 0 no ano
- [x] Despesas na DRE — Corrigido: despesas agora itemizadas por conta gerencial, agrupadas por classificação (Operacionais, Administrativas, Financeiras, Não Operacionais)

### Apontamentos v32 (07/04/2026) — Reestruturar Fechamento Anual conforme modelo Excel
- [x] Remover subtítulo "DRE Gerencial — Visão Mês a Mês", deixar apenas "Visão Mês a Mês"
- [x] Verificar e remover seção de Deduções (não faz parte do modelo)
- [x] Reestruturar tabela: Seção 1 = Receita de Vendas (canais + Total Receita)
- [x] Reestruturar tabela: Seção 2 = Despesas agrupadas (Operacionais, Administrativas, Financeiras, Outras Despesas) com subtotais por grupo + TOTAL DESPESAS
- [x] Reestruturar tabela: Seção 3 = Outras Receitas (Empréstimos, Outras Receitas, Total)
- [x] Reestruturar tabela: Seção 4 = Resumo Final (Total Receita, CMV, % Margem, Receita Líquida, Despesa, Resultado, % Resultado)
- [x] Receita Líquida no modelo = Receita - CMV (não Receita - Deduções)
- [x] Remover coluna AV% da tabela, manter apenas % no Total

### Apontamentos v33 (08/04/2026) — Melhorias Fechamento Anual (modelo v2)
- [x] % Despesa sobre Faturamento: mudar cálculo de % para valor_despesa / faturamento_total (não % sobre total_despesas)
- [x] Flag isPreOperacional: adicionar campo boolean na tabela managementAccounts para marcar contas pré-operacionais
- [x] Marcar conta "Imóvel Alugado" como isPreOperacional no banco
- [x] Backend: separar despesas pré-operacionais no retorno do getYearlyClosing
- [x] Frontend Resumo Final: separar "Despesa" (sem pré-operacional) e "Despesa Pré-Operacional" como linhas distintas
- [x] Frontend: criar seção "Resultado Sem Pré-Operacional" (Receita Líquida - Despesas operacionais)
- [x] Frontend: criar seção "Resultado Com Pré-Operacional" (Resultado anterior - Pré-Operacional + Outras Receitas)
- [ ] Interface de Contas Gerenciais: adicionar toggle isPreOperacional na criação/edição (pendente)

### Apontamentos v34 (08/04/2026) — Ajustes Fechamento Anual + Bug Receita
- [x] Fechamento Anual: remover cor vermelha das linhas de despesa (manter apenas separação de grupo)
- [x] Fechamento Anual: renomear "Pré-Operacional" para "Investimentos Operacionais" (flag, backend, frontend)
- [x] Fechamento Anual: renomear campo isPreOperacional para isInvestimentoOperacional no banco e schema
- [x] Fechamento Anual: resultado negativo em vermelho, positivo em verde (valor e %)
- [x] BUG Receita: ao editar receita (ex: alterar conta gerencial), o valor original era multiplicado por 100 — causa: divisão /100 indevida em listOtherRevenues e queries DRE. Corrigido em 3 locais + 3 registros restaurados no banco

### Apontamentos v35 (08/04/2026) — Ajustes Visuais Fechamento Anual
- [x] Cards na impressão: números cortados/desenquadrados ao gerar PDF — ajustado CSS @media print (print:text-lg, print:whitespace-nowrap, print:grid-cols-5)
- [x] Título: trocar "Fechamento Anual" + subtítulo para apenas "Análise de Resultado Anual"
- [x] Remover texto "Conta" do cabeçalho da primeira coluna da tabela DRE
- [x] Título na impressão: trocar "Fechamento Anual — DRE" para "Análise de Resultado Anual"

### Apontamentos v36 (08/04/2026) — Correção Fluxo de Caixa Anual
- [x] Fluxo de Caixa: corrigir cálculo — incluir vendas à vista (Balcão + Delivery) como entrada de caixa
- [x] Fluxo de Caixa: revisar lógica de Recebido vs Pago para refletir movimentação real de caixa
- [x] Fluxo de Caixa: card no Fechamento Anual com breakdown detalhado (Entradas: Vendas à Vista + Recebimentos A Prazo + Outras Receitas / Saídas: Pagamento Compras + Pagamento Despesas)
- [x] Fluxo de Caixa: testes vitest para validar consistência dos cálculos (5 testes passando)
- [x] Fluxo de Caixa: Recebimentos A Prazo corrigido — query alterada de receivablePayments para customerPayments (tabela principal de baixas)
- [x] Bug: Liberar garçom no Dashboard retorna erro "Invalid input: expected string, received undefined" — corrigido: handleCheckIn/handleCheckOut enviavam userId em vez de waiterId
- [x] Melhoria: Tela 'Fora do Horário' do garçom atualiza automaticamente (polling 5s quando bloqueado, 30s quando liberado)
- [x] Exportação inventário: incluir colunas 'Destino Produção' e 'Disponível Salão' para empresas com salão ativo (Hamburgueria)
- [x] Bug: Ao zerar estoque via acerto manual, a data de vencimento antiga agora é automaticamente limpa (expirationDate = null)
- [x] Bug: Exportação de despesas em Excel agora busca TODOS os registros via endpoint exportAll (não apenas a página atual)
- [x] Bug: Cards de total de despesas agora mostram totais gerais (totalActiveAmount/totalCancelledAmount do backend)
- [x] Melhoria: Filtro por tipo de despesa (Conta Gerencial) adicionado na Análise de Despesas

### Apontamentos v37 (14/05/2026) — Fix Login em Loop (Cloud Run Cold Start)
- [x] Bug Crítico: Login em loop na produção — Cloud Run cold start (503) faz OAuth callback falhar antes do código executar
- [x] Solução: warmUpAndLogin() no frontend faz ping em /api/ping antes de redirecionar para OAuth, garantindo container ativo
- [x] Endpoint /api/ping adicionado ao servidor (resposta leve "pong", sem DB)
- [x] Endpoint /api/oauth/health adicionado para monitoramento
- [x] OAuth callback com retry logic: se falhar, redireciona para novo login (até 2 tentativas), container já quente na 2ª
- [x] Logging detalhado no OAuth callback (tempo de cada etapa: token exchange, user info, upsert, session)
- [x] DashboardLayout.tsx: botão Sign in usa warmUpAndLogin() em vez de redirect direto
- [x] main.tsx: handler de erro UNAUTHORIZED usa warmUpAndLogin() em vez de redirect direto
- [x] 7 testes vitest validando a implementação do warm-up

### Apontamentos v38 (14/05/2026) — Fix Login Loop (Cookie + Host Mismatch)
- [x] Bug Crítico: Login loop persistia mesmo após warm-up — causa raiz: host/origin mismatch no Cloud Run
- [x] Diagnóstico: req.get('host') retornava hostname interno do Cloud Run (*.a.run.app) em vez do domínio público (abrwf.manus.space)
- [x] Fix: getCanonicalOrigin() em cookies.ts — detecta domínio público via x-forwarded-host, Origin, Referer headers
- [x] Fix: Cookie sameSite alterado de "none" para "lax" — sameSite:none requer secure:true, que pode falhar atrás de proxy
- [x] Fix: OAuth callback retry agora usa state parameter (base64 da redirectUri original) em vez de req.get('host')
- [x] Fix: warmUpAndLogin melhorado com 3 tentativas de ping (5s, 10s, 15s timeout progressivo)
- [x] Fix: app.set('trust proxy', true) para detecção correta de HTTPS atrás de Cloud Run/Cloudflare
- [x] Debug endpoint /api/debug/headers mostra canonicalOrigin para diagnóstico
- [x] 11 testes vitest validando cookie config, canonical origin, retry logic e warm-up

### Apontamentos v39 (14/05/2026) — Fix Login Loop (WKWebView Cookie Issue)
- [x] Bug Crítico: Login loop persistia em iOS in-app browser (WKWebView) — causa raiz: WKWebView descarta Set-Cookie em respostas 302
- [x] Fix: OAuth callback success path agora retorna HTML 200 com spinner + JS redirect em vez de 302 redirect
- [x] A página intermediária "Entrando no sistema..." garante que o browser processa o Set-Cookie antes de navegar para /
- [x] Meta-refresh como fallback caso JavaScript esteja desabilitado
- [x] Debug endpoints /api/debug/cookie-set e /api/debug/cookie-check para diagnóstico de cookies em produção

### Apontamentos v40 (14/05/2026) — Fix Login Loop (Resiliência Auth)
- [x] Bug: Login loop intermitente — auth.me retorna null apesar de cookie válido (debug/auth confirma que auth funciona)
- [x] Diagnóstico: Erro transitório no DB (cold start / connection pool) causa authenticateRequest falhar → ctx.user = null → login screen
- [x] Fix: authenticateRequest agora wrapa lastSignedIn upsert em try-catch (erro não-fatal)
- [x] Fix: context.ts agora loga quando auth falha apesar de ter session cookie (para diagnóstico)
- [x] Fix: useAuth agora faz retry automático (até 2x) quando auth.me retorna null mas session cookie existe
- [x] Fix: useAuth mantém loading=true durante retries para evitar flash da tela de login
- [x] Fix: main.tsx agora usa debounce (3 erros consecutivos em 5s) antes de redirecionar para login
- [x] Fix: getDb() agora tenta conectar até 3x com delay progressivo no cold start
- [x] Fix: getUser() agora faz retry com reconnect se primeira tentativa falhar
- [x] Debug endpoint /api/debug/auth mostra passo a passo da autenticação (cookie → JWT → DB)

### Apontamentos v41 (14/05/2026) — Fix 503 Service Unavailable no OAuth Callback
- [x] Bug Crítico: OAuth callback retorna 503 "Service Unavailable" quando Cloud Run está em cold start
- [x] Diagnóstico: Cloud Run retorna 503 ANTES do Express inicializar — código server-side nunca executa
- [x] Fix: Service Worker (sw-auth.js) intercepta requests ao /api/oauth/callback e faz retry automático (até 5x com backoff exponencial)
- [x] Fix: SW faz ping /api/ping antes de cada retry para acordar o container
- [x] Fix: warmUpAndLogin melhorado com timeout de 15s (suficiente para cold start de 10s) e 4 tentativas
- [x] Fix: warmUpAndLogin mostra overlay visual "Conectando ao servidor..." durante warm-up
- [x] Fix: SW registrado em main.tsx com scope "/" para interceptar todas as rotas /api/*

### Apontamentos v42 (14/05/2026) — Fix definitivo: Marker Cookie + Retry Agressivo
- [x] Bug Identificado: Cookie de sessão (app_session_id) é httpOnly — JavaScript NÃO consegue ler via document.cookie
- [x] Bug: useAuth tentava checar document.cookie.includes('app_session_id') que SEMPRE retornava false
- [x] Bug: Sem detecção de sessão existente, o retry nunca era ativado e login screen aparecia imediatamente
- [x] Fix: Cookie marker "logged_in=1" (não-httpOnly) setado junto com o cookie de sessão no OAuth callback
- [x] Fix: useAuth agora checa logged_in=1 para saber se sessão existe e faz até 4 retries com backoff
- [x] Fix: main.tsx global error handler ignora UNAUTHORIZED quando logged_in marker existe (erro transitório)
- [x] Fix: Logout limpa o marker logged_in tanto no client (document.cookie) quanto no server (clearCookie)
- [x] Fix: Callback HTML page espera 1.5s e verifica se logged_in=1 está acessível antes de navegar para /

### Apontamentos v43 (14/05/2026) — Heartbeat Keep-Alive + Content-Type Fix
- [x] Fix: Heartbeat endpoint /api/scheduled/keep-alive adicionado para manter container Cloud Run aquecido
- [x] Pendente: Criar cron job heartbeat via manus-heartbeat CLI após deploy (a cada 5 min) — task_uid: Knm8L4Dp6tqZBDmcnaq77S
- [x] Fix: Content-Type explícito 'text/html; charset=utf-8' na resposta HTML do OAuth callback (iOS Safari baixava como arquivo)
- [x] Fix: Cache-Control 'no-store' na resposta do callback para evitar caching

### Apontamentos v44 (14/05/2026) — Investigação e Correção de Lentidão
- [x] Investigar: Pool de conexões DB — drizzle já usa mysql2.createPool() internamente (OK)
- [x] Investigar: Queries lentas nas rotas tRPC — CONVERT_TZ na coluna forçava full table scan (700ms+)
- [x] Investigar: Índices faltantes — saleItems sem índice em saleId/productId (143k rows sem índice!)
- [x] Investigar: N+1 queries — getGrossMarginByCategory buscava range amplo e filtrava em JS
- [x] Fix: Índices críticos adicionados: idx_saleItems_saleId, idx_saleItems_productId, idx_sales_company_status_date, idx_po_company_status_date, idx_pm_product_date
- [x] Fix: Todas as queries do dashboard reescritas com range-based UTC boundaries (60x mais rápido)
- [x] Fix: 20+ queries de análise de vendas otimizadas com helper saleDateRangeWhere()
- [x] Fix: Fechamento mensal otimizado (compras, despesas, recebíveis) — removido CONVERT_TZ em WHERE
- [x] Fix: getGrossMarginByCategory otimizado com UTC boundaries direto no Drizzle (sem filtro JS)

### Apontamentos v45 (15/05/2026) — Lentidão residual + Erro de token ao salvar venda
- [x] Investigar: Erro de token — React Query fazia 3 retries automáticos em mutations (padrão), causando toast de erro + venda salva no retry
- [x] Investigar: Lentidão residual — dashboard.stats executava 8+ queries sequenciais + N+1 para clientes
- [x] Investigar: Query getSales (recent sales) fazia full table scan (130k rows) por CONVERT_TZ no SELECT impedindo uso de índice
- [x] Fix: Desabilitar retry em mutations (retry: false) para evitar duplicação e falsos erros
- [x] Fix: Configurar QueryClient com staleTime=30s e refetchOnWindowFocus=false
- [x] Fix: Paralelizar dashboard.stats com Promise.all (8 queries em paralelo)
- [x] Fix: Eliminar N+1 na busca de clientes das vendas recentes (Promise.all + Map)
- [x] Fix: Remover CONVERT_TZ do SELECT em getSales e converter timezone em JS
- [x] Fix: Criar índice idx_sales_company_saledate (companyId, saleDate DESC)
- [x] Resultado: Dashboard warm 281ms (antes ~1500ms sequencial), Recent sales 8ms (antes 664ms)

### Bug v45.1 (15/05/2026) — Divergência de horário no frontend (dupla conversão timezone)
- [x] Fix: Removido convertSaleDatesToBrazil() do server (dupla conversão: server -3h + frontend timeZone -3h = -6h)
- [x] Fix: Removido CONVERT_TZ do SELECT em getSale() e getSalesForExport() — retornam UTC, frontend converte
- [x] Fix: Removido CONVERT_TZ do SELECT em getRevenueGoalHistory() — createdAt retorna UTC
- [x] Fix: Adicionado timeZone: 'America/Sao_Paulo' na exportação Excel de vendas
- [x] Verificado: Queries de análise (DATE/DAY/YEARWEEK com CONVERT_TZ) estão corretas — retornam strings de data, não timestamps
- [x] Regra: Servidor retorna datas em UTC, frontend converte com timeZone: 'America/Sao_Paulo'

### Bug v45.2 (15/05/2026) — Horário ainda incorreto + lentidão ao filtrar vendas
- [x] Fix: Horário mostrando ~03:00 (UTC) — causa: new Date('YYYY-MM-DD HH:MM:SS') interpreta como hora local no Safari/iOS, não UTC
- [x] Fix: Restaurado CONVERT_TZ no SELECT de getSales, getSale, getSalesForExport (server retorna Brasília)
- [x] Fix: Frontend agora parseia datas com regex ao invés de new Date() — funciona igual em todos os browsers
- [x] Fix: Atualizado formatDateTimeBR e formatDateBR em shared/dateUtils.ts com parsing manual
- [x] Fix: Atualizado formatDateTime em Vendas.tsx, formatTime em Home.tsx, export Excel
- [x] Fix: canEditOrCancel em SaleDetailsModal agora usa offset -03:00 para cálculo correto
- [x] Verificado: Query de vendas com filtro usa índice idx_sales_company_saledate (4ms DB, 9ms warm)
- [x] Regra definitiva: Server retorna datas Brasília via CONVERT_TZ + Frontend parseia com regex (sem new Date)

### Apontamentos v46 (15/05/2026) — Erro JSON na confirmação de compra + Delay nas telas
- [x] Bug: Erro de JSON ao confirmar compra — causa: Cloud Run cold start (3-5s) + 120+ queries sequenciais = timeout
- [x] Bug: Delay ao carregar telas — causa: Cloud Run min-instances=0, cold start em cada request

### Apontamentos v46.1 (15/05/2026) — Causa raiz sistêmica + Correções robustas
- [x] Investigar: /api/ping (sem DB) leva 2.4-5.4s em produção = cold start puro do Cloud Run
- [x] Fix: Guard de idempotência no confirmPurchaseOrder (verifica CONFIRMED antes de processar)
- [x] Fix: Reject de compra CANCELLED
- [x] Fix: deletePurchaseCompletely agora limpa productMovements e priceHistory
- [x] Limpeza: 32 movimentos + 32 priceHistory + 10 journals órfãos da NF 24238238 removidos
- [x] Limpeza: Custo médio restaurado para 24 produtos afetados
- [x] Fix: Endpoint keep-alive heartbeat criado (tRPC keepAlive.setup + /api/scheduled/keep-alive)
- [x] Fix: Heartbeat a cada 5 min para manter container quente
- [ ] Pendente: Ativar heartbeat keep-alive após deploy (precisa publicar primeiro)

### Apontamentos v47 (15/05/2026) — CRÍTICO: Guard de idempotência marcava CONFIRMED prematuramente
- [x] BUG CRÍTICO: Guard de idempotência marcava CONFIRMED ANTES de processar itens → compra #7260001 confirmada com 0 itens
- [x] Fix: Status CONFIRMED movido para APÓS processamento completo de todos os itens (linha 1542-1544 de db.ts)
- [x] Fix: Guard no início apenas verifica status (CONFIRMED → return silencioso, CANCELLED → throw error) sem alterar status
- [x] Fix: Compra #7260001 (NF 1234589) revertida para DRAFT no banco — Gabriel pode adicionar itens e confirmar
- [ ] Pendente: Produção (abrwf.com.br) mostra dashboard zerado — provável versão desatualizada (precisa publicar checkpoint)

### Bug v47.1 (15/05/2026) — Erro "The string did not match the expected pattern" ao confirmar compra
- [ ] Investigar: Erro de validação ao clicar "Confirmar" na tela de Compras em produção
- [ ] Fix: Corrigir validação zod/tRPC que rejeita input na confirmação

### Bug v47.2 (15/05/2026) — CRÍTICO: Guard de idempotência NÃO impede re-confirmação (3x entradas duplicadas)
- [x] BUG: Compra NF 173937 confirmada 3 vezes (17:25, 17:26, 18:58) — 3 entradas de +500 cada no Copo Ultra 700ml
- [x] CAUSA RAIZ: Status mudava para CONFIRMED somente APÓS processar itens → requests concorrentes passavam pelo guard
- [x] Fix: Lock otimista via UPDATE WHERE status='DRAFT' (atomic SQL) — apenas 1 request processa
- [x] Fix: Validação de compra sem itens (items.length === 0 → throw error + reverte status para DRAFT)
- [x] Fix: Campo purchaseDate corrigido para postingDate || issueDate || getNowInBrazil()
- [x] Fix: Botão Confirmar agora mostra diálogo de confirmação + desabilita durante processamento
- [x] Limpeza: 2 movimentos duplicados deletados (ids 60990021, 61080003), estoque corrigido 1507 → 507

### Bug v47.3 (16/05/2026) — Contas a Receber: cliente Luciano não aparece na busca
- [x] BUG: Cliente "Luciano" não aparece em Contas a Receber — saldo real é -R$ 41 (crédito), filtro só mostrava saldo > 0
- [x] Investigar: Saldo Luciano = R$ 149 vendas - R$ 190 pagamentos = -R$ 41 (crédito)
- [x] Fix: Alterar Contas a Receber para mostrar TODOS os clientes com vendas a prazo (não apenas saldo > 0)
- [x] Fix: Exibir clientes com saldo zero/crédito com indicação visual diferente (verde = crédito, vermelho = devedor)

### Bug v47.4 (16/05/2026) — Venda BALCAO: "Selecione um canal de venda primeiro"
- [x] BUG: Ao tentar realizar venda BALCAO, erro "Selecione um canal de venda primeiro" impede a venda
- [x] CAUSA RAIZ: useEffect de auto-select rodava antes dos canais carregarem + comparação de code não normalizava acentos
- [x] Fix: Auto-select robusto com normalização NFD + fallback no handleAddProduct que tenta selecionar antes de dar erro

### Bug v47.5 (17/05/2026) — CRÍTICO: "The string did not match the expected pattern" em Safari/iOS
- [x] BUG: Ao finalizar venda ou confirmar compra em produção (iOS Safari), erro "The string did not match the expected pattern"
- [x] CAUSA RAIZ: Bug específico do Safari/WebKit — quando response.json() é chamado em resposta 204/empty body, Safari lança DOMException com essa mensagem (Chrome ignora silenciosamente)
- [x] Fix: Safari-safe fetch wrapper no tRPC client (main.tsx) que intercepta respostas 204/empty e retorna JSON sintético
- [x] Fix: Error handlers em createSale e confirmPurchase detectam esse erro e tratam como possível sucesso (refetch + warning)
- [x] Fix: Guard contra NaN no channelId (parseInt("") → NaN) com mensagem clara ao usuário
- [x] Testes passando: 18/18 performance-fixes.test.ts

### Fix v47.6 (17/05/2026) — Resiliência: Tela de Produtos vazia
- [x] BUG: Tela de Produtos mostra "Nenhum produto cadastrado ainda" intermitentemente (dados não carregam)
- [x] INVESTIGAÇÃO: Heartbeat keep-alive ativo e funcionando (765 execuções) — cold start NÃO é a causa
- [x] INVESTIGAÇÃO: getProducts com companyId undefined retorna todos os produtos — não deveria dar vazio
- [x] CAUSA PROVÁVEL: Falha transiente de conexão DB (getDb retorna null → return []) ou Safari fetch bug
- [x] Fix: React Query global retry aumentado de 1 para 2, com retryDelay exponencial rápido (500ms, 1000ms, 2000ms)
- [x] Fix: Query products.list na tela de Produtos com retry=3 específico (mais agressivo que o global)
- [x] Fix: UI de erro com botão "Recarregar" quando query falha (isError state)
- [x] Fix: UI inteligente para resultado vazio — distingue "nenhum cadastrado" vs "nenhum encontrado com filtros"
- [x] Fix: Logging aprimorado no servidor — getProducts loga quando DB não disponível e quando companyId é undefined
- [x] Fix: products.list procedure loga EMPTY RESULT com companyId e input para diagnóstico
- [x] Testes: 18/18 performance-fixes.test.ts passando

### Fix v47.7 (24/05/2026) — Exportação de Produtos: preços dos canais não aparecem para A Brasa
- [x] BUG: Ao exportar produtos da A Brasa Reúne, colunas de preço dos canais de venda ficam todas vazias
- [x] CAUSA RAIZ: Exportação usava IDs fixos (1, 2, 3, 4) da Adega; A Brasa usa IDs dinâmicos (30001, 60001, 90001)
- [x] Fix: Exportação agora usa canais dinâmicos da empresa ativa (query salesChannels.list) ao invés de IDs hardcoded
- [x] Fix: Colunas de preço no Excel agora são geradas dinamicamente com o nome real do canal (ex: "Preço Balcão", "Preço iFood")
- [x] Fix: Largura das colunas no Excel também é dinâmica, adaptando-se ao número de canais da empresa
- [x] Testes: 4/4 export-dynamic-channels.test.ts passando

### Sprint Abertura A Brasa Reúne (07/06/2026)

#### Verificação de Lentidão e Disponibilidade
- [ ] Revisar queries críticas do módulo Salão (pedidos, comanda, KDS)
- [ ] Verificar heartbeat e cold start para fluxos de atendimento
- [ ] Otimizar carregamento inicial das telas de Salão/KDS/Garçom

#### Impressoras por Departamento ✅
- [x] Criar tabela `printers` no schema (id, companyId, name, department, connectionType, ipAddress, port, paperWidth, active)
- [x] Criar procedures CRUD para impressoras (admin only)
- [x] Criar tela de configuração de impressoras no painel admin (Salão > Impressoras)
- [x] Integrar impressoras com fluxo de pedidos do salão (Cozinha, Bar, Caixa)
- [x] Ao enviar pedido, rotear itens para impressora correta baseado no productionDestination do produto
- [x] Implementar impressão de comanda no caixa ao encerrar conta
- [x] Utilitário compartilhado `printTicket.ts` com funções reutilizáveis
- [x] 13/13 testes passando (printers.test.ts)

#### Ajuste Arquitetura de Impressão v48.1 (05/06/2026)
- [x] Remover auto-print do celular do garçom (SalaoComanda.tsx)
- [x] Implementar auto-print no KDS Cozinha ao detectar novos itens PENDING
- [x] Implementar auto-print no KDS Bar ao detectar novos itens PENDING
- [x] Implementar auto-print no Caixa ao detectar conta fechada (nova tela SalaoCaixa)
- [x] Manter botão manual de reimprimir no KDS como fallback
- [x] Botão toggle de auto-print (verde=ativo) no header do KDS e Caixa
- [x] Endpoint recentlyClosedOrders no salon router
- [x] Rota /salao/caixa com link no SalaoMesas
- [x] 26/26 testes auto-print-architecture.test.ts passando

#### Print Agent Nativo v48.2 (05/06/2026)
- [x] Criar print-agent/ diretório com serviço Node.js standalone
- [x] Implementar formatador ESC/POS para tickets de produção e cupons
- [x] Implementar envio TCP direto para impressoras por IP
- [x] Criar endpoint /status para health check do agent
- [x] Criar endpoint /print para receber jobs de impressão
- [x] Criar client-side printService.ts que detecta agent e envia comandos
- [x] Integrar printService no KDS Cozinha (substituir window.print)
- [x] Integrar printService no KDS Bar (substituir window.print)
- [x] Integrar printService no Caixa (substituir window.print)
- [x] Fallback: se agent offline, usar window.print como antes
- [x] Documentação de instalação do Print Agent no computador central
- [x] Tela Impressoras: indicador de status do Print Agent + botão Sincronizar + Testar
- [x] 24/24 testes print-agent.test.ts passando

#### Enviar para Produção em Lote v48.3 (05/06/2026) ✅
- [x] Adicionar status DRAFT ao enum de salonOrderItems
- [x] Itens na comanda começam como DRAFT (não enviados para produção)
- [x] Botão "Enviar para Produção" na comanda que muda status de DRAFT → PENDING em lote
- [x] Itens DRAFT ficam visíveis apenas na comanda do garçom (não aparecem no KDS)
- [x] KDS só detecta e imprime itens quando mudam para PENDING (após envio)
- [x] Print Agent: ticket agrupa todos os itens do mesmo envio por comanda
- [x] Diagnóstico: HTTPS→localhost funciona (Chrome trata localhost como secure context)
- [x] Causa real: impressão estava no celular do garçom (agora corrigido para KDS)
- [x] 82/82 testes passando (4 test files)

#### Fix Impressão Automática v48.4 (05/06/2026)
- [x] Fix: printService deve tentar enviar direto ao agent sem depender de cache de status (eliminar fallback desnecessário para window.print)
- [x] Fix: KDS Bar não imprimiu - itens PENDING na carga inicial devem ser impressos se forem recentes (< 2min)
- [x] Fix: KDS Cozinha mesmo problema - itens recentes na carga inicial devem ser impressos automaticamente
- [x] Fix: Aumentar robustez do check de agent (retry, timeout maior, sem cache negativo)

#### Fix Impressão Automática v48.5 (05/06/2026) — Eliminar fallback window.print do KDS
- [x] Remover callback de fallback (printProductionTicket) das chamadas printProductionTicketViaAgent no KDS Cozinha
- [x] Remover callback de fallback (printProductionTicket) das chamadas printProductionTicketViaAgent no KDS Bar
- [x] Quando agent offline: mostrar toast.error("Print Agent offline") sem abrir popup
- [x] Manter botão manual de reimprimir no KDS (esse pode usar window.print como último recurso)

#### Fix Impressão v48.6 — Chrome Local Network Access (05/06/2026)
- [x] Trocar AGENT_URL de http://localhost:9100 para http://127.0.0.1:9100 (IP privado = isento de mixed content)
- [x] Adicionar targetAddressSpace: "local" em todos os fetch() ao agent (Chrome LNA exemption)
- [x] Adicionar Access-Control-Allow-Private-Network header no Print Agent (Chrome PNA preflight)
- [x] Adicionar Access-Control-Allow-Local-Network header no Print Agent

#### Fix Impressão v48.9 — Diferenciar agent offline vs erro de impressora (06/06/2026)
- [x] printService.ts: tryPrintViaAgent retorna PrintResult com agentOnline/printerError
- [x] KDS Cozinha: toast diferencia "Agent offline" vs "Erro na impressora: ..."
- [x] KDS Bar: toast diferencia "Agent offline" vs "Erro na impressora: ..."
- [x] Print Agent: resposta HTTP 500 inclui message estruturada com IP/porta da impressora
- [x] Print Agent: versão atualizada para v1.2 (header no console)

#### Impressão Silenciosa — Comanda e Cupom via Print Agent (06/06/2026)
- [x] "Imprimir Comanda" no celular do garçom: enviar via Print Agent para impressora do Caixa (sem window.print)
- [x] "Emitir Cupom da Venda" no fechamento: enviar via Print Agent para impressora do Caixa (sem window.print)
- [x] Ambos devem usar o mesmo padrão do KDS (printReceiptViaAgent com toast de erro diferenciado)

#### Fix Impressão Comanda v49.1 — Relay via Servidor (06/06/2026)
- [ ] Problema: celular do garçom não acessa localhost:9100 do computador central
- [ ] Solução: frontend envia dados de impressão ao backend (tRPC), backend armazena job em fila, Print Agent faz polling no servidor para buscar jobs pendentes
- [ ] Criar tabela printJobs no banco (id, type, payload, status, createdAt)
- [ ] Criar rota tRPC: salon.requestPrint (insere job na fila)
- [ ] Criar endpoint público GET /api/print-jobs/pending (Print Agent faz polling)
- [ ] Criar endpoint público POST /api/print-jobs/:id/complete (Print Agent marca como concluído)
- [ ] Atualizar Print Agent para fazer polling no servidor a cada 2s
- [ ] Atualizar frontend: "Imprimir Comanda" usa tRPC em vez de fetch direto ao agent

### FEAT: Fila de Impressão via Servidor (Print Queue) ✅ (06/06/2026)
- [x] Tabela `printJobs` no banco (companyId, type, department, payload, status, timestamps)
- [x] Endpoint REST GET /api/print-jobs/pending (agent polling)
- [x] Endpoint REST POST /api/print-jobs/complete (agent reporta resultado)
- [x] tRPC mutation salon.requestPrint (frontend envia job para fila)
- [x] tRPC mutation salon.requestPrintMulti (múltiplos departamentos)
- [x] SalaoComanda (garçom celular) usa fila do servidor em vez de acesso direto ao agent
- [x] SalaoCaixa (desktop) mantém impressão direta via agent (mesmo computador)
- [x] Print Agent v2.0 com polling automático do servidor (busca jobs PENDING a cada 2s)
- [x] Backoff automático em caso de erros consecutivos no polling
- [x] Expiração de jobs PENDING > 5 minutos (evita reimpressão após restart)
- [x] Testes vitest para toda a arquitetura

### BUG-FIX: Documento Impresso - Subtotal e Formato (06/06/2026)
- [x] Subtotal na tela e impressão agora calcula soma de TODOS os itens ativos (não usa order.subtotal do banco que pode estar desatualizado)
- [x] Nome da empresa removido do cabeçalho — agora imprime "Pré-visualização da Conta — Mesa X" igual à tela
- [x] Formato do recibo impresso agora espelha a pré-visualização da tela (permanência, pessoas, vlr unit, total por item, total sem serviço, por pessoa)
- [x] Corrigido companyId no printers.json (era 1, agora 2 = A Brasa Reúne)

### BUG-FIX: Fechamento de Conta do Salão (06/06/2026)
- [x] Pagamento dividido não funciona — adicionado modal de confirmação final para evitar fechamento acidental
- [x] Subtotal divergente na tela de Vendas — closeOrder agora recalcula subtotal a partir dos itens (fonte autoritativa)
- [x] Taxa de serviço agora aparece no campo observação da venda: "Comanda #X | Mesa Y | Z pessoa(s) | SALÃO | Taxa de serviço (10%): R$ XX,XX"

### FEAT: Página Pública do Cardápio (07/06/2026)
- [x] Endpoint público trpc.cardapio.getMenu (busca produtos ativos excluindo Ingredientes)
- [x] Página /cardapio com layout mobile-first e branding A Brasa Reúne
- [x] Agrupamento automático: Burgers, Entradas, Cervejas, Drinks, Sucos, Águas & Refrigerantes
- [x] Nomes em maiúsculo conforme solicitado
- [x] Acessível via abrwf.com.br/cardapio (após publicação)

### MELHORIA: Cardápio Digital - Layout e Funcionalidades (07/06/2026)
- [x] Redesign layout conforme PDF referência (fundo creme, acentos laranja, linhas pontilhadas, separadores diamante)
- [x] Seções com duas colunas para bebidas (Cervejas, Drinks, Águas, Sucos)
- [x] Seção Drinks com fundo escuro conforme referência
- [x] Água Tônica deve ficar em "Água e Refrigerante" (não em Drinks)
- [x] Adicionar item "Cardápio" no menu lateral do ERP
- [x] Atualização dinâmica quando nome/valor/descrição do produto mudar

### FIX: Cardápio - Impressão e Aviso de Inauguração (07/06/2026)
- [x] Eliminar terceira página em branco na impressão (removido pb-20, min-height, ajustado print CSS)
- [x] Remover mensagem de inauguração do cardápio principal (cardápio fica limpo e atemporal)
- [x] Criar página separada /aviso-inauguracao para impressão como folha avulsa (A5 landscape)
- [x] Aviso inclui: logo, mensagem de boas-vindas, menção Copa do Mundo, taxa de serviço 10%
- [x] Print CSS otimizado: @page A5 landscape, esconde badge Manus, sem páginas extras
- [x] Rota /aviso-inauguracao registrada no App.tsx

### Cardápio - Ajustes visuais (11/06/2026)
- [x] Bandeira EUA mesmo tamanho que as outras bandeiras (Canada/Mexico)
- [x] Aumentar espaçamento entre Para Compartilhar e Água e Refrigerante
- [x] Seção Sobremesa posicionada abaixo da Copa do Mundo (antes de Para Compartilhar)
- [x] Inserir ícone da taça da Copa ao lado do título Copa do Mundo
- [x] Guaraná Antarctica 300ML ativo mas não aparece no cardápio (corrigido: availableInSalon era 0, atualizado para 1)
- [x] Alinhar preços nas seções de 2 colunas (Água/Refrigerante, Sucos, Cervejas) - adicionado min-w-[70px] text-right tabular-nums
- [x] Corrigir impressão do cardápio - otimizado para 2 páginas (descrições mantidas, fontes compactas, page break reposicionado)

## Sprint 12/06/2026 — Print Agent v3.0

- [x] Print Agent: Porta da API alterada de 9100 para 9111 (evita conflito com impressoras)
- [x] Print Agent: Polling adaptativo com backoff (5s normal → 30s em erro/429)
- [x] Print Agent: Processamento paralelo de jobs (não bloqueia fila)
- [x] Print Agent: Deduplicação de jobs (evita reimprimir se reportJobComplete falhar)
- [x] Print Agent: Retry automático para conexões TCP com timeout (5s + 1 retry)
- [x] Print Agent: Logs com timestamp (horário de São Paulo)
- [x] Print Agent: Watchdog que reinicia polling se parar inesperadamente
- [x] Print Agent: Graceful shutdown (SIGINT/SIGTERM)
- [x] Print Agent: Estatísticas de uso no endpoint /status
- [x] Print Agent: Título "Adega Beira Rio" no recibo impresso
- [x] Print Agent: Documentação completa (README.md) com troubleshooting
- [x] Print Agent: Script de auto-start para Windows (install-service.js)
- [x] Print Agent: Atualizado printService.ts para usar nova porta 9111
- [x] Fix: stockMovements.ts — corrigidos erros de TypeScript (input schema)
- [x] Fix: Teste print-queue atualizado para v3.0

## Sprint 12/06/2026 — Melhorias Tela de Mesas

- [x] Exibir última observação lançada no card da mesa (auxiliar garçom a identificar)
- [x] Novo modo de rateio: seleção de itens consumidos por pessoa (além do rateio por valor)
