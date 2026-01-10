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

