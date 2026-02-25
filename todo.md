# ABRWF - Pendências e Melhorias

**Última atualização:** 15/02/2026

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
- [ ] Garantir que pedidos cancelados NÃO aparecem na lista (remover completamente)
- [ ] Campo Data: usar campo inicio_da_entrega em vez do campo atual
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
- [ ] 1. Cards de Resumo (Faturamento, Lucro Bruto, Despesas, Resultado Líquido) + Comparativo Mês Anterior
- [ ] 2. Vendas por Canal (Qtd, Faturamento, %, Ticket Médio) + Metas (Meta, Realizado, % Atingido)
- [ ] 3. Vendas por Categoria (Faturamento, %, Margem) + Compras por Categoria (Valor, %) lado a lado
- [ ] 4. Faturamento por Tipo de Pagamento (Tipo, Qtd Transações, Faturamento, %)
- [ ] 5. Estoque por Categoria (Inicial, Final, Variação) + Giro de Estoque (CMV/Estoque Médio)
- [ ] 6. Despesas por Conta Gerencial (Conta, Classificação, Valor, %)
- [ ] 7. Compras por Fornecedor (Fornecedor, Valor, %, Qtd Notas)

### Backend
- [ ] Criar queries para cada seção com filtro de competência
- [ ] Implementar cálculo de giro de estoque
- [ ] Implementar comparativo mês anterior
- [ ] Endpoint tRPC consolidado para fechamento mensal

### Frontend
- [ ] Refatorar componente Fechamento.tsx
- [ ] Criar componentes para cada seção
- [ ] Implementar layout responsivo
- [ ] Adicionar seletor de competência (mês/ano)

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
- [ ] Calendário: destacar automaticamente feriados nacionais/regionais
- [ ] Permitir destaque manual de dias específicos (ex: loja fechada)
- [ ] Visão Mensal: adicionar coluna Faturamento Diário (Total / Dias Corridos)

### Análise por Canal
- [ ] Adicionar quantidade de vendas em cada card
- [ ] Adicionar ticket médio das vendas

### Análise de Vendas
- [ ] Filtro de datas específicas (feriados) para análise e previsão

---

## 🏢 ACESSO POR EMPRESA

- [x] Fase 1: Fundação (tabelas companies, branches, userCompanies, contexto, seletor)
- [x] Fase 2: Isolamento de dados operacionais (vendas, compras, despesas, recebíveis, estoque, fechamento)
- [ ] Fase 3: Isolamento de parcelas (purchaseInstallments, expenseInstallments, receivableInstallments)
- [ ] Fase 4: Isolamento de contabilidade (journals, accountingEntries)
- [ ] Fase 5: Testes de integração e validação end-to-end

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
<<<<<<< Updated upstream


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

=======
>>>>>>> Stashed changes

### Investigação: Despesas não sendo enviadas para Contas a Pagar (06/02/2026)
- [ ] Verificar o fluxo de criação de despesas no backend
- [ ] Verificar se há integração entre despesas e contas a pagar
- [ ] Identificar o problema e implementar correção
- [ ] Testar o fluxo completo de despesas para Contas a Pagar

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


### BUG-09: Contabilização não reconhece despesa após alterar competenceMonth
- [ ] Despesa foi movida manualmente de fev/26 para jan/26 no banco (entryDate e competenceMonth)
- [ ] Após recontabilizar janeiro, a despesa não aparece no relatório contábil
- [ ] Conta "Simples Nacional a Recolher" continua com R$ 0,00 em janeiro
- [ ] Precisa verificar qual campo a contabilização usa para filtrar despesas por mês
- [ ] Pode estar usando createdAt, issueDate ou outro campo em vez de competenceMonth


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
- [ ] Aguardando teste do usuário: editar despesa pelo sistema para acionar reprocessamento
- [ ] Após edição, verificar se journal antigo foi deletado e novo criado
- [ ] Contabilizar janeiro novamente e confirmar que despesa aparece no relatório

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
- [ ] Aguardando teste: editar despesa de impostos pelo sistema para recriar journal
- [ ] Verificar que journal foi recriado com competência 2026-01
- [ ] Contabilizar janeiro e confirmar que despesa aparece no relatório

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
- [ ] Aguardando teste: editar despesa pelo sistema e verificar que não duplica
- [ ] Contabilizar janeiro e confirmar que aparece apenas em janeiro


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
- [ ] Excluir compra #3960002 (Comercial Bolsão - R$ 237,63)
- [ ] Reverter lançamentos contábeis da compra
- [ ] Reverter parcelas no Contas a Pagar
- [ ] Implementar endpoint de exclusão de compras confirmadas

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
- [ ] Cadastro de produto na A Brasa mostra canais da Adega (Balcão, Delivery 99Food, Delivery Próprio, Delivery iFood)

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

### Auditoria companyId em db.insert() (24/02/2026)
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
- [ ] Pendente: accounting.ts createAccount (chartOfAccounts) - companyId via data
- [ ] Pendente: accounting.ts createManagementAccount (managementAccounts) - companyId via data
- [ ] Pendente: accountingBatchLog - companyId via data
- [ ] Pendente: productCompositions no setProductCompositions - sem companyId

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
