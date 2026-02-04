# ABRWF - Pendências e Melhorias

**Última atualização:** 21/01/2026

---

## 📋 ESTRUTURA DA EQUIPE

| Membro | Papel | Responsabilidades |
|--------|-------|-------------------|
| **Gabriel** | Product Owner / Desenvolvedor | Idealizar melhorias, identificar problemas, definir prioridades e validar entregas |
| **ChatGPT** | Co-Desenvolvedor / Apoio Técnico | Aprofundar regras, esclarecer pontos técnicos, sugerir soluções e revisar código |
| **Aurora (Manus)** | Desenvolvedora Principal | Execução de código, implementação de funcionalidades e evolução técnica |

---

## 🔴 BUGS CRÍTICOS

### BUG-01: Vendas Delivery - Número do Pedido
- [ ] Ao editar venda Delivery, não traz o número do pedido lançado inicialmente
- [ ] Ao editar, não está salvando a alteração do número do pedido

### BUG-02: Edição de Compras - Juros
- [ ] Ao editar uma compra inserindo juros, não está salvando o novo valor dos produtos
- [ ] Total da nota não atualiza após inserção de juros

### BUG-03: Timezone
- [ ] Verificar se ainda existem módulos ou funções com divergência de timezone

---

## 🟡 MELHORIAS PRIORITÁRIAS

### Vendas A Prazo - Alterar Cliente
- [ ] Possibilitar alteração de cliente em venda a prazo já lançada
- [ ] Evitar necessidade de cancelar e criar nova venda

### Compras e Despesas - Trava de Edição
- [ ] Implementar prazo máximo de 3 dias para edição/cancelamento
- [ ] Importante devido à contabilização implementada

### Compras - Produto Duplicado
- [ ] Produto já selecionado não deve aparecer novamente no autocomplete
- [ ] Mesma lógica já existente em outros módulos

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

### Produtos a Excluir
- [ ] IDs: 5280001, 5280002, 5310001, 5310002, 5310003, 4950001, 4950002, 4950003, 4950004, 2070009

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
