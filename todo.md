# ABRWF - Pendências e Melhorias

**Última atualização:** 08/01/2026

---

## 📅 DATAS IMPORTANTES

| Data | Evento | Status |
|------|--------|--------|
| **18/10/2025** | Início do desenvolvimento do sistema | ✅ Concluído |
| **08/01/2026** | Sistema completo e publicado em produção | ✅ Concluído |
| **A partir de 09/01/2026** | Fase de melhorias e ajustes pontuais | 🔄 Em andamento |

**Duração do desenvolvimento:** ~82 dias (18/10/2025 a 08/01/2026)

---

---

## 🔴 PENDÊNCIAS PRIORITÁRIAS

### 1. Catálogo Digital + Integração ABRWF
- [ ] Definir escopo da integração catálogo ↔ ERP
- [ ] Criar endpoint /api/catalogo no ERP
- [ ] Sincronizar produtos e preços do canal Balcão
- [ ] Adicionar indicador de disponibilidade (estoque)
- [ ] Avaliar necessidade de pedidos online

### 2. Exportar Relatórios
- [ ] Análise de Vendas → Exportar para Excel/PDF
- [ ] Fechamento Mensal → Exportar para PDF
- [ ] Produtos → Já implementado ✅
- [ ] Contas a Receber → PDF para envio ao cliente
- [ ] Contas a Pagar → Exportar para Excel/PDF

### 3. Histórico de Log (Auditoria)
- [ ] Criar tabela de logs no banco de dados
- [ ] Registrar alterações em: Produtos, Parceiros, Vendas, Compras
- [ ] Campos: usuário, data/hora, ação, dados anteriores, dados novos
- [ ] Tela de consulta de logs com filtros

### 4. Contas a Receber - Exportação PDF
- [x] Gerar PDF com extrato do cliente
- [x] **BUG:** Filtrar apenas transações que formam o saldo atual (não histórico completo)
- [x] **BUG:** Ajustar logo no PDF: aumentar tamanho e remover fundo branco
- [x] **BUG:** Remover páginas vazias extras no PDF
- [x] Adicionar hora na coluna de data (formato DD/MM/YYYY HH:MM)
- [x] Adicionar coluna de número da venda
- [x] Ajustar alinhamento e largura das colunas
- [x] Layout profissional para envio ao cliente
- [ ] Opção de enviar por email/WhatsApp

### 5. Documentação do Sistema ("Livro")
- [ ] Visão geral e arquitetura técnica
- [ ] Stack tecnológico (React, tRPC, Drizzle, TiDB, etc.)
- [ ] Fluxogramas de processos principais
- [ ] Documentação de cada módulo:
  - [ ] Dashboard
  - [ ] Produtos
  - [ ] Vendas
  - [ ] Parceiros
  - [ ] Compras
  - [ ] Despesas
  - [ ] Contas a Receber
  - [ ] Contas a Pagar
  - [ ] Metas
  - [ ] Fechamento Mensal
  - [ ] Análises
  - [ ] Gerenciamento de Usuários
- [ ] Guia de uso para cada perfil (Admin, Operacional, Consultor)
- [ ] Glossário de termos
- [ ] FAQ / Perguntas Frequentes

### 6. Configuração do DRE
- [ ] Classificar despesas por tipo (operacional, financeiro, administrativo)
- [ ] Definir estrutura de contas contábeis
- [ ] Mapear categorias de despesas para contas do DRE
- [ ] Implementar distribuição de custos indiretos
- [ ] Criar visualização de DRE com estrutura correta
- [ ] Validar cálculos de lucro bruto, operacional e líquido

### 7. Impressão de Fechamento
- [ ] Adicionar logo da empresa no cabeçalho
- [ ] Ajustar layout para impressão A4
- [ ] Configurar margens e espaçamentos
- [ ] Testar impressão em diferentes navegadores

---

## 🟡 MELHORIAS IDENTIFICADAS

### Performance
- [ ] Otimizar queries de Análise de Vendas (índices, cache)
- [ ] Implementar paginação em listagens grandes
- [ ] Lazy loading de dados pesados

### UX/Interface
- [ ] Tooltips explicativos nos formulários
- [ ] Confirmação antes de deletar registros
- [ ] Melhorar responsividade mobile
- [ ] Atalhos de teclado para ações frequentes

### Funcionalidades
- [ ] Comparar quantidade entre canais (Balcão vs Delivery vs A Prazo)
- [ ] Sistema de comissões por canal delivery
- [ ] Card de ticket médio no dashboard
- [ ] Alertas por email para estoque crítico
- [ ] Notificações push para metas atingidas

### Integrações
- [ ] Integração com WhatsApp Business API
- [ ] Integração com sistemas de delivery (iFood, Rappi)
- [ ] Importação automática de notas fiscais (XML)

### Segurança
- [ ] Autenticação de dois fatores (2FA)
- [ ] Sessões com expiração automática
- [ ] Logs de acesso por usuário

---

## ✅ CONCLUÍDO RECENTEMENTE

- [x] **INTEGRAÇÃO WHATSAPP:** Envio de extrato de Contas a Receber via WhatsApp (09/01/2026)
  - Botão "WhatsApp" na tela de detalhes do cliente
  - Gera PDF, faz upload para S3 e envia via WhatsApp API
  - Mensagem personalizada com saldo, limite e crédito disponível
- [x] **BUG CORRIGIDO:** Vendas canceladas ainda geravam saldo a receber (09/01/2026)
  - Corrigidas 3 funções para excluir vendas CANCELADA do cálculo de saldo
  - getCustomerBalance(), getCustomerReceivableDetail(), getCustomersWithBalance()
  - Função cancelSale() agora deleta recebível, parcelas e pagamentos
  - Limpeza de recebíveis órfãos existentes no banco
- [x] Backup automático diário para Google Drive (08/01/2026)
- [x] Notificação por email após backup (08/01/2026)
- [x] Política de retenção: 7 dias local, 30 dias Drive (08/01/2026)
- [x] Meta tags Open Graph atualizadas (08/01/2026)
- [x] Sistema de Metas mensais por canal
- [x] Fechamento Mensal com DRE simplificado
- [x] Controle de acesso por perfil (Admin/Operacional/Consultor)
- [x] Exportação de Produtos para Excel
- [x] Rateio de frete/taxas no custo dos produtos

---

## 📊 ESTATÍSTICAS DO SISTEMA

- **Produtos cadastrados:** ~983
- **Vendas migradas:** 2022-2026
- **Usuários ativos:** 3 perfis (Admin, Operacional, Consultor)
- **Backup:** Diário às 3h (GMT-3)
- **Uptime:** 99.9%



### 8. Integração WhatsApp - Envio de Extrato (09/01/2026)
- [x] Configurar credenciais WhatsApp no ERP
- [x] Implementar endpoint tRPC para envio via WhatsApp
- [x] Adicionar botão de envio no frontend (Contas a Receber)
- [x] Testar integração com envio real
- [ ] Validar recebimento no celular do cliente (aguardando teste do usuário)
### 9. BUG: Botão WhatsApp não aparece na tela de Contas a Receber (09/01/2026)

- [x] O botão WhatsApp está no arquivo ContasReceber.tsx mas a rota usa ContasReceberNovo.tsx
- [x] Adicionar botão WhatsApp no ContasReceberNovo.tsx (área de botões linha 222-250)

### 10. BUG: PDF mostrando apenas 2 vendas no histórico (09/01/2026)
- [x] Usuário reportou que só aparecem 2 vendas para cliente Victor Hugo com saldo R$ 165,50
- [x] Corrigido: PDF agora mostra todas as 30 vendas/débitos do cliente (2 páginas, 48KB)

### 11. Integração WhatsApp - Configuração (09-10/01/2026)
- [x] Token de acesso atualizado (usuário do sistema)
- [x] Phone Number ID correto identificado: 1005788860213963
- [x] API respondendo corretamente com dados do número +55 11 98603-7317
- [x] Template de mensagem criado e enviado para análise (extrato_conta_corrente)
- [ ] **PENDENTE:** Template foi criado na Conta 1, mas o número está na Conta 2
- [ ] **PRÓXIMO PASSO:** Criar template na conta correta (Conta 2 - onde está o número conectado)
- [ ] Aguardar aprovação do template pelo WhatsApp
- [ ] Atualizar código para usar o nome do template aprovado
- [ ] Testar envio real após aprovação

### 12. BUG: PDF mostrando histórico completo ao invés de vendas em aberto (09/01/2026)
- [x] Corrigida lógica para selecionar apenas vendas mais recentes que formam o saldo
- [x] Alexandre (R$ 52) - PDF correto: 2 vendas = R$ 52,00
- [x] Victor (R$ 165,50) - PDF correto: 3 vendas = R$ 183,00 (saldo após pagamento parcial)

### 13. BUG: Produtos próximos ao vencimento mostrando incorretamente (09/01/2026)
- [x] Kaut 2l aparece como próximo ao vencimento mas não tem estoque - CORRIGIDO
- [x] Adicionado filtro para ignorar produtos com estoque <= 0
- [x] Pepsi Black 350ml - vencimento antigo removido manualmente

### 14. PDF Contas a Receber - Tratamento de pagamentos parciais (09/01/2026)
- [ ] Decidir como exibir abatimentos quando cliente tem pagamento parcial
- **Opção 1 (Recomendada)**: Resumo compacto no final do PDF
  ```
  Total em Compras:          R$ 183,00
  (-) Pagamentos:            R$ 17,50
  SALDO DEVEDOR:             R$ 165,50
  ```
- **Opção 2**: Resumo no cabeçalho antes das vendas
  ```
  Saldo Devedor: R$ 165,50
  (Total R$ 183,00 - Pagamentos R$ 17,50)
  ```
- Objetivo: Cliente entender de onde vem o saldo quando há pagamentos parciais

### 15. BUG: Edição de venda não puxa preços do canal correto (10/01/2026)
- [x] Ao editar venda do iFood, produtos mostram "Preço: N/D"
- [x] Sistema deveria puxar automaticamente os preços do canal da venda (iFood/Delivery)
- [x] Corrigido: Adicionado `includePrices: true` na query de produtos do SaleDetailsModal


### 16. Ocultar produtos de migração no autocomplete de vendas (10/01/2026)
- [x] Produtos com "(Migração de Dados)" no nome não devem aparecer no autocomplete
- [x] Desativados no banco de dados (active = 0)


### 17. Backup Automático em Produção (11/01/2026)
- [x] Configurar backup automático no servidor de produção
- [x] Integrar upload para Google Drive via API (preparado, aguarda credenciais)
- [x] Configurar notificação por email após backup (via Manus)
- [x] Testar execução completa do backup (4.16s, 32.80 MB)
- [x] Agendar execução diária às 3h (GMT-3)
- **IMPLEMENTAÇÃO:** Endpoint HTTP POST /api/backup criado em server/backupEndpoint.ts, agendado via cron para rodar diariamente

## Sprint 15/01/2026 - Levantamento de Melhorias Críticas

### 18. Produtos Vencendo - Validação de Dados Fantasmas
- [ ] Verificar se existem produtos marcados como vencidos sem data de validade registrada
- [ ] Identificar casos onde validade de entrada não foi cadastrada corretamente
- [ ] Criar query para detectar inconsistências (produtos vencidos sem data_validade)
- [ ] Implementar validação na entrada de estoque (obrigar data de validade para produtos com controle)
- [ ] Gerar relatório de produtos com dados inconsistentes

### 19. Despesas - Tipo "Perdas" (Crítico)
- [ ] Quando tipo = "Perdas", forma de pagamento deve ser automática "Perdas"
- [ ] Valor da parcela deve preencher automaticamente
- [ ] **BUG**: Perdas não está registrando mesmo com produto e quantidade informados
- [ ] Verificar se há erro na query de inserção
- [ ] Testar fluxo completo: produto → quantidade → salvar
- [ ] Implementar validação de dados obrigatórios

### 20. Tela de Fechamento - Novos Quadros de Análise
- [ ] Quadro: Vendas por Tipo (hoje mostra por Canal: Delivery, Balcão, A Prazo)
- [ ] Quadro: Vendas por Categoria de Produtos
- [ ] Quadro: Compras por Categoria de Produtos
- [ ] Quadro: Acompanhamento de Margem (novo)
- [ ] Implementar filtros por período e categoria

### 21. Contas Gerenciais - Reorganização de Categorias
- [ ] Usuário está finalizando organização das contas gerenciais
- [ ] Alinhamento com plano contábil
- [ ] Necessário entender como fazer alteração no sistema
- [ ] Possível impacto em relatórios e fechamentos

### 22. Backup - Validação de Execução
- [ ] Verificar se backup está sendo executado corretamente
- [ ] Confirmar se upload para Google Drive está acontecendo
- [ ] Validar se limpeza de arquivos antigos funciona
- [ ] Testar notificações de sucesso/falha

## Sprint 15/01/2026 - Plano Contábil e Gerencial (PRIORIDADE ALTA)

### 23. Implementação do Plano Contábil e Gerencial
- [ ] **Fase 1: Mapeamento Contábil (1 semana)** - Integrar plano contábil atual
  - [ ] Criar tabela `accountingMappings` no schema
  - [ ] Importar 50 contas gerenciais do arquivo Excel
  - [ ] Mapear contas existentes de despesas
  - [ ] Testar geração de DRE com dados atuais
  
- [ ] **Fase 2: Receitas (1-2 semanas)** - Mapear receitas de vendas
  - [ ] Criar tabela `revenueAccounts`
  - [ ] Adicionar contas contábeis para receitas (3.4.01.xxx)
  - [ ] Modificar endpoint de vendas para registrar conta contábil
  - [ ] Implementar cálculo de receita líquida
  
- [ ] **Fase 3: Estoque e CMV (2-3 semanas)** - Rastrear custo de mercadoria
  - [ ] Criar tabela `inventoryAccounts`
  - [ ] Adicionar contas contábeis para compras e CMV
  - [ ] Implementar cálculo de CMV na venda
  - [ ] Implementar cálculo de Lucro Bruto
  
- [ ] **Fase 4: Contas Patrimoniais (3-4 semanas)** - Gerar balanço
  - [ ] Criar estrutura de contas patrimoniais (1.x, 2.x, 4.x)
  - [ ] Integrar com movimentação de caixa
  - [ ] Integrar com contas a receber/pagar
  - [ ] Gerar balanço patrimonial

### 24. Validação com Contador
- [ ] Confirmar estrutura do plano contábil com contador
- [ ] Validar se há outras receitas além de vendas
- [ ] Definir se precisa de controle de estoque por lote (para validade)
- [ ] Definir período de início do novo plano
- [ ] Estratégia de migração de dados históricos

**NOTA CRÍTICA:** O plano atual está bem estruturado mas INCOMPLETO. Contempla apenas despesas e custos. Necessário adicionar receitas, estoque e contas patrimoniais para DRE completo.


## Sprint 19/01/2026 - Implementação Plano Contábil (INICIADO)

### 25. Sistema de Contabilização - Fase 1 (19/01/2026)
- [x] Extrair e analisar plano contábil do arquivo Excel (51 contas identificadas)
- [x] Criar tabela `managementAccounts` (Contas Gerenciais)
- [x] Criar tabela `accountingMappings` (Mapeamento Contábil)
- [x] Criar tabela `chartOfAccounts` (Plano de Contas)
- [x] Adicionar campos `managementAccountId` e `accountingCode` em expenses
- [x] Importar 50 contas gerenciais do plano aprovado
- [x] Criar mapeamentos contábeis automáticos
- [x] Criar endpoints tRPC para gerenciar contas (listManagementAccounts, listForSelect, listGrouped, getAccountingCode)
- [x] Atualizar frontend de Despesas para usar contas gerenciais (dropdown com busca)
- [x] Testes unitários: 8 testes passando
- [ ] Testar fluxo completo de lançamento com contabilização (em andamento)
- [ ] Validar geração de DRE com novos dados
- [ ] Migrar despesas existentes para novas contas gerenciais


### 26. BUG: Erro ao salvar despesa com conta gerencial (19/01/2026)
- [x] Erro: "Failed query: insert into expenses" - managementAccountId sendo enviado como número
- [x] Corrigido: Alterado tipo da coluna managementAccountId de VARCHAR para INT


### 27. BUG: Erro ao editar despesa - categoryId undefined (19/01/2026)
- [x] Endpoint de update espera categoryId obrigatório
- [x] Atualizado para aceitar managementAccountId e accountingCode
- [x] categoryId agora é opcional para retrocompatibilidade
- [x] Frontend carrega managementAccountId ao editar despesa
