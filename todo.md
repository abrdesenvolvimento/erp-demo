# ABRWF - Pendências e Melhorias

**Última atualização:** 19/01/2026

---

## 📅 DATAS IMPORTANTES

| Data | Evento | Status |
|------|--------|--------|
| **18/10/2025** | Início do desenvolvimento do sistema | ✅ Concluído |
| **08/01/2026** | Sistema completo e publicado em produção | ✅ Concluído |
| **19/01/2026** | Contabilização completa (Despesas + Receitas + DRE) | ✅ Concluído |
| **A partir de 20/01/2026** | Fase de melhorias e ajustes pontuais | 🔄 Em andamento |

**Duração do desenvolvimento:** ~82 dias (18/10/2025 a 08/01/2026)

---

## 🔴 BUGS PENDENTES (PRIORIDADE ALTA)

### BUG 1: Vendas - Código do Pedido não carrega na edição
- [ ] Ao editar uma venda, o código do pedido digitado originalmente não está sendo trazido
- [ ] Ao alterar a venda, o código não está aparecendo na tela inicial
- [ ] Exportação de vendas deve incluir observações da venda

### BUG 2: Contas a Pagar - Alteração de data de vencimento
- [ ] Ao alterar data de vencimento de uma despesa, não está refletindo no Contas a Pagar
- [ ] Verificar se o update está atualizando a tabela de parcelas corretamente

---

## 📊 CONTABILIZAÇÃO (PRÓXIMOS PASSOS)

### Fase 1: Despesas ✅ CONCLUÍDO (19/01/2026)
- [x] Plano de contas gerenciais (50 contas importadas)
- [x] Mapeamento contábil automático
- [x] Lançamento de despesas com conta gerencial
- [x] Perdas Estoque com baixa automática de estoque
- [x] Migração de despesas existentes

### Fase 2: Receitas ✅ CONCLUÍDO (19/01/2026)
- [x] Contas de receita por canal (Balcão, Delivery, A Prazo)
- [x] Atribuição automática de conta por tipo de venda
- [x] Lançamentos de receita automáticos
- [x] Deduções (descontos) contabilizadas
- [x] Migração de 19 dias de vendas

### Fase 3: DRE Completo ✅ CONCLUÍDO (19/01/2026)
- [x] Receita Bruta separada por canal
- [x] Receita Líquida (após deduções)
- [x] CMV (Custo de Mercadoria Vendida)
- [x] Lucro Bruto com margem
- [x] Despesas por classificação (Operacional, Administrativa, Financeira)
- [x] Resultado Operacional e Líquido

### Fase 4: Balanço Patrimonial (PENDENTE)
- [ ] Criar estrutura de contas patrimoniais (Ativo, Passivo, PL)
- [ ] Integrar Ativo: Estoque, Contas a Receber, Caixa
- [ ] Integrar Passivo: Contas a Pagar, Fornecedores
- [ ] Gerar balanço patrimonial simplificado

### Validação com Contador
- [ ] Confirmar estrutura do plano contábil
- [ ] Validar se há outras receitas além de vendas
- [ ] Definir período de início do novo plano

---

## 📈 ANÁLISES E RELATÓRIOS

### Análise de Despesas - Agrupamento por Tipo
- [ ] Separar despesas por grupo de tipo de conta (Operacional, Administrativa, Financeira)
- [ ] Avaliar melhor forma de classificar as contas gerenciais
- [ ] Implementar visualização agrupada no relatório de análise

### Tela de Fechamento - Novos Quadros
- [ ] Quadro: Vendas por Categoria de Produtos
- [ ] Quadro: Compras por Categoria de Produtos
- [ ] Quadro: Acompanhamento de Margem
- [ ] Implementar filtros por período e categoria

### Exportar Relatórios
- [ ] Análise de Vendas → Exportar para Excel/PDF
- [ ] Fechamento Mensal / DRE → Exportar para PDF
- [ ] Contas a Pagar → Exportar para Excel/PDF
- [x] Produtos → Já implementado ✅
- [x] Contas a Receber → PDF para envio ao cliente ✅

---

## 📱 CATÁLOGO DIGITAL + INTEGRAÇÃO

### Catálogo Digital ABRWF
- [ ] Definir escopo da integração catálogo ↔ ERP
- [ ] Criar endpoint /api/catalogo no ERP
- [ ] Sincronizar produtos e preços do canal Balcão
- [ ] Adicionar indicador de disponibilidade (estoque)
- [ ] Avaliar necessidade de pedidos online

---

## 📚 DOCUMENTAÇÃO DO SISTEMA ("LIVRO")

### Visão Geral
- [ ] Visão geral e arquitetura técnica
- [ ] Stack tecnológico (React, tRPC, Drizzle, TiDB, etc.)
- [ ] Fluxogramas de processos principais

### Documentação por Módulo
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

### Guias e Referências
- [ ] Guia de uso para cada perfil (Admin, Operacional, Consultor)
- [ ] Glossário de termos
- [ ] FAQ / Perguntas Frequentes

---

## 🔧 MELHORIAS TÉCNICAS

### Histórico de Log (Auditoria)
- [ ] Criar tabela de logs no banco de dados
- [ ] Registrar alterações em: Produtos, Parceiros, Vendas, Compras
- [ ] Campos: usuário, data/hora, ação, dados anteriores, dados novos
- [ ] Tela de consulta de logs com filtros

### Performance
- [ ] Otimizar queries de Análise de Vendas (índices, cache)
- [ ] Implementar paginação em listagens grandes
- [ ] Lazy loading de dados pesados

### Segurança
- [ ] Autenticação de dois fatores (2FA)
- [ ] Sessões com expiração automática
- [ ] Logs de acesso por usuário

---

## 💡 MELHORIAS FUTURAS

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
- [ ] Integração com WhatsApp Business API (template pendente aprovação)
- [ ] Integração com sistemas de delivery (iFood, Rappi)
- [ ] Importação automática de notas fiscais (XML)

---

## ✅ CONCLUÍDO RECENTEMENTE

### 19/01/2026 - Contabilização Completa
- [x] Plano de contas gerenciais (50 contas)
- [x] Contabilização de despesas com código contábil
- [x] Perdas Estoque com baixa automática
- [x] Contabilização de receitas por canal
- [x] DRE completo na página de Fechamento
- [x] CMV calculado automaticamente
- [x] Despesas por classificação (Operacional, Administrativa, Financeira)

### 09-11/01/2026 - Integrações e Correções
- [x] Integração WhatsApp - Envio de extrato de Contas a Receber
- [x] BUG: Vendas canceladas gerando saldo a receber
- [x] BUG: PDF mostrando histórico completo ao invés de vendas em aberto
- [x] Backup automático diário para Google Drive
- [x] Notificação por email após backup

### 08/01/2026 - Sistema em Produção
- [x] Sistema completo publicado
- [x] Meta tags Open Graph atualizadas
- [x] Sistema de Metas mensais por canal
- [x] Fechamento Mensal com DRE
- [x] Controle de acesso por perfil

---

## 📊 ESTATÍSTICAS DO SISTEMA

- **Produtos cadastrados:** ~983
- **Vendas migradas:** 2022-2026
- **Usuários ativos:** 3 perfis (Admin, Operacional, Consultor)
- **Backup:** Diário às 3h (GMT-3)
- **Uptime:** 99.9%
