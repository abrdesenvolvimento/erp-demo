# TODO - Sistema ERP Adega Beira Rio

## Bugs Críticos em Correção

- [x] Reverter layout de vendas de 2 colunas para coluna única (formulário no topo, resumo abaixo)
- [x] Corrigir edição de produtos compostos - composições não aparecem ao editar produto existente
- [x] Corrigir baixa de estoque para produtos compostos em vendas (deve deduzir dos componentes, não do composto)
- [x] Implementar cálculo automático de custo para produtos compostos baseado no custo dos componentes

## Novos Bugs Reportados (Testes do Usuário - Rodada 1)

- [x] Custo de produto composto não atualiza quando custo dos componentes muda (apenas calcula na criação)
- [x] Formulário de vendas precisa de mais espaço vertical para evitar scroll excessivo
- [x] Histórico de pagamentos em Contas a Pagar não aparece após efetuar baixa

## Novos Bugs Reportados (Testes do Usuário - Rodada 2)

- [x] Formulário de vendas ainda expande e causa scroll - precisa ser maior para evitar isso
- [x] Atualização de custo de produto composto - Funcionando corretamente
- [x] Contas a Receber - Não é possível consultar histórico do cliente após quitação
- [x] Baixa de produto composto - Funcionando perfeitamente
- [x] Baixa e consulta em Contas a Pagar - Funcionando perfeitamente

## Melhorias Implementadas

### Sprint 1 - Validações e Cálculos Automáticos
- [x] Validação de estoque ao adicionar produtos em vendas
- [x] Validação de código EAN (13 dígitos)
- [x] Validação de CPF/CNPJ em parceiros
- [x] Cálculo automático de parcelas em compras
- [x] Cálculo automático de parcelas em despesas

### Sprint 2 - Busca e Filtros
- [x] Busca automática de CEP em parceiros (ViaCEP API)
- [x] Filtros e busca em Contas a Receber
- [x] Filtros e busca em Contas a Pagar
- [x] Atalhos de teclado globais (G+tecla para navegação, Ctrl+K para busca, ? para ajuda)

### Sprint 3 - UX/UI
- [x] Labels melhorados (formatação de tipos de venda, formas de pagamento)
- [x] Indicadores visuais de vencimento em Contas a Pagar (cores por status)
- [x] Reorganização de campos de endereço em Parceiros (CEP no topo, campos separados)

## Correções de Sistema
- [x] Contas a Pagar agora mostra tanto compras quanto despesas
- [x] Compras não geram mais despesas automaticamente
- [x] Pagamento de parcelas de compras funcionando corretamente
- [x] Produtos compostos podem ser criados com composições temporárias
- [x] Limpeza completa do banco de dados (dados de teste removidos)

## Funcionalidades Futuras
- [ ] Dashboard com gráficos e relatórios
- [ ] Relatórios de vendas por período
- [ ] Relatórios de produtos mais vendidos
- [ ] Relatórios financeiros (fluxo de caixa)
- [ ] Exportação de relatórios em PDF/Excel
- [ ] Sistema de backup automático
- [ ] Logs de auditoria (quem fez o quê e quando)
- [ ] Notificações de vencimentos próximos
- [ ] Gestão de usuários e permissões
- [ ] Tooltips em campos complexos

## Observações Técnicas
- TypeScript com erros não-bloqueantes (campo paidDate em db.ts)
- Sistema rodando em porta 3001
- Banco de dados MySQL limpo e pronto para produção
- GitHub sincronizado: https://github.com/abrdesenvolvimento/Projeto-ERP-ABR



## Ajustes Solicitados (Rodada 3)

- [x] Ajustar coluna ID no histórico de pagamentos para mostrar apenas número (remover prefixos #purchase- e #expense-)



## Rebranding - ABRWF (Rodada 4)

- [x] Limpar banco de dados - remover produtos, vendas, compras, parceiros de teste
- [ ] Atualizar logo do sistema para ABRWF
- [ ] Atualizar nome do sistema para "ABRWF - Administração Baseada em Resultados Workflow"
- [x] Copiar logo para diretório público do projeto



- [x] Ajustar tamanho do logo ABRWF para ficar visualmente proporcional



- [x] Atualizar caminho do logo no código para usar logo-abrwf.png



## Melhorias de UX (Rodada 5)

- [x] Implementar animação de carregamento (loading spinner) no dashboard enquanto dados são carregados



## Melhorias de Branding e UX (Rodada 6)

### Aplicação de Cores ABRWF
- [x] Definir paleta de cores no tema (dourado, verde, azul-petróleo)
- [x] Aplicar cores na sidebar (fundo azul-petróleo, hover dourado)
- [x] Ajustar cores de gráficos e indicadores
- [x] Estilizar cards do dashboard com bordas coloridas
- [x] Criar botões primários com gradiente dourado → verde

### Seção "Minha Conta"
- [x] Criar página de perfil do usuário
- [x] Implementar edição de informações pessoais (nome, email, telefone)
- [x] Adicionar upload de foto de perfil (UI pronta, backend pendente)
- [x] Criar seção de alteração de senha
- [x] Adicionar histórico de atividades do usuário
- [x] Adicionar link "Minha Conta" no menu dropdown do usuário

### Nova Tela de Login
- [x] Não aplicável - Sistema usa autenticação OAuth externa


## Melhorias Solicitadas (09/12/2025)

- [x] Substituir Select por autocomplete na busca de produtos em Perdas (Despesas)

## Bugs Corrigidos (12/12/2025)

- [x] Cálculo de crédito disponível incorreto em nova venda a prazo - agora usa mesma lógica de getCustomerBalance

## Bugs Reportados (12/12/2025 - Tarde)

- [x] Cálculo de parcelas em Compras está incorreto - usa custo unitário ao invés do total (subtotal + frete + taxas) e não atualiza ao adicionar novos produtos


## Sprint Dezembro/2025 - Melhorias Priorizadas

### Bugs de UX (Prioridade 1)
- [x] Formulário de Vendas - Aumentar para evitar scroll quando nome do produto é grande (problema também no mobile)
- [x] Edição de Venda - Permitir editar número do pedido delivery em vendas com até 24h

### Melhorias de UX (Prioridade 2)
- [x] Calendário Contas a Pagar - Visão visual de valores a pagar por dia, ao clicar lista fornecedores/títulos
- [x] Análise de Vendas - Iniciar sem datas selecionadas (usuário escolhe o período)
- [x] Análise de Vendas - Adicionar totalizador de coluna (Total Produtos + % por produto)
- [ ] Tela de Compras - Auto-scroll para linha do novo produto ao adicionar
- [ ] Tela de Compras - Exibir subtotal (Qtd × Preço Unit.) em cada linha de produto

### Documentação e Impressão (Prioridade 3)
- [ ] Documento de Venda - Incluir Razão Social, Endereço, CNPJ e Inscrição Estadual da empresa
- [ ] Documento de Venda - Mostrar nome do usuário que gerou a venda (tela + impressão)

### Relatórios e Análises (Prioridade 4)
- [ ] Margem Líquida Delivery - Card com margem considerando dedução de 7% do iFood
- [ ] Módulo de Metas - Definir metas mensais e acompanhar evolução (Meta × Realizado)
- [ ] Fechamento Mensal - Tela com receita, despesa e resultado (R$ e %)

### Infraestrutura (Prioridade 5)
- [ ] Backup - Definir estratégia de backup automático dos dados
- [ ] Contingência - Plano para indisponibilidade do servidor de produção
- [ ] Migração de Legado - Aguardando De/Para para importar dados históricos

### Bugs Reportados (16/12/2025)
- [x] Vendas - Auto-scroll para linha do novo produto ao adicionar (scroll sobe em vez de descer)
- [x] Compras - Auto-scroll para linha do novo produto ao adicionar
- [x] Compras - Chave de acesso não carrega ao editar compra existente
- [x] Contas a Pagar Calendário - Mostrar forma de pagamento (destacar pagamentos com cartão de crédito pessoal ex: "Crédito G")
- [x] Análise de Vendas - Totalizador já estava implementado corretamente na aba "Análise de Valores"

### Bugs Reportados (16/12/2025 - Tarde)
- [x] Análise de Vendas - Iniciar sem período selecionado (selectedDays agora inicia vazio)
- [x] Análise de Vendas - Adicionar % de participação na coluna "Total" da tabela de produtos (100% em todas as colunas do totalizador)
- [x] Contas a Pagar Calendário - Ao clicar no item do dia, agora abre modal de pagamento direto (não vai mais para detalhes do fornecedor)
- [x] Divergência de faturamento - Corrigido: getSalesCalendar agora exclui vendas canceladas (consistente com dashboard.stats)

### Bugs Reportados (16/12/2025 - Noite)
- [x] Contas a Pagar - Modal de pagamento agora abre corretamente ao clicar no título do calendário (corrigido handleOpenPaymentModal)
- [x] Análise de Vendas - Filtro de dias agora funciona (adicionado useMemo para filtrar dayData por dias selecionados)
- [x] Análise de Vendas - % real adicionado em todas as colunas (Qtd, Faturamento, Custo, Lucro) mostrando participação de cada produto
- [x] Análise de Vendas - Produtos já selecionados agora são ocultados no filtro de busca

### Bugs Reportados (16/12/2025 - Noite - Parte 2)
- [x] Análise de Vendas - % adicionado na coluna Total da aba "Evolução Diária" (calcula % de participação de cada produto)
- [x] Contas a Pagar - Modal de pagamento simplificado (chama setShowPaymentModal diretamente sem usar handleOpenPaymentModal)

### Bugs Reportados (17/12/2025 - Manhã)
- [x] Contas a Pagar Calendário - Adicionado botão "Pagar" explícito em cada título do dia (mais claro para o usuário)
- [x] Dashboard Margem Bruta - Corrigido para usar mesma lógica de timezone do Dashboard (America/Sao_Paulo)

### Bugs Reportados (17/12/2025 - Manhã - Parte 2)
- [x] Contas a Pagar - Botão "Pagar" agora abre o modal corretamente (criado componente CalendarPayButton separado)
- [x] Dashboard Margem Bruta - Valor agora usa o mesmo faturamento do card principal (corrigido)

### Melhorias Solicitadas (17/12/2025)
- [x] Contas a Pagar - Renomear "Fornecedores com Saldo a Pagar" para "Histórico de Fornecedores"
- [x] Contas a Pagar - Mostrar todos os fornecedores (com ou sem saldo pendente) no histórico
- [x] Contas a Pagar - Manter mesma tela de detalhes ao clicar no fornecedor
- [x] Contas a Pagar - Histórico de Fornecedores: exibir resultados apenas após confirmar pesquisa
- [x] Contas a Pagar - Histórico de Fornecedores: adicionar filtro por status (todos, com saldo, sem saldo)
- [x] Contas a Pagar - Histórico de Fornecedores: tela mais limpa com filtros no topo

### Bugs Reportados (17/12/2025 - Tarde)
- [x] Mg Bruta - Faturamento Total agora usa finalAmount proporcionalizado (consistente com outras telas)

### Melhorias de Data de Vencimento (17/12/2025)
- [x] Compras/Despesas - Data de vencimento padrão: data do lançamento (não mais +30 dias)
- [x] Compras/Despesas - Crédito G/R/ABR parcelado: 1ª parcela manual, demais +30 dias automático (editável)
- [x] Compras/Despesas - Boleto parcelado: todas as datas manuais (pode ser 7/14/21 dias)
- [x] Compras/Despesas - À Vista/Débito Automático: data padrão = data do lançamento (editável)

### Novas Categorias (17/12/2025)
- [x] Criar categoria de despesa "Custo Operacional" (para lançar sacolas plásticas, etc.)

### Bugs Críticos (28/12/2025)
- [x] OAuth callback failed - Problema temporário no servidor OAuth da Manus (resolvido automaticamente)

### Sprint 28/12/2025 - Melhorias Simples e Práticas

#### Dados da Empresa (Corrigidos)
- Razão Social: Adega Beira Rio Comércio de Bebidas Ltda
- Endereço: Rua Israel, 286 - Rochdale, Osasco/SP CEP 06220-053
- CNPJ: 50.887.052/0001-08

#### Tarefas
- [x] Contas a Pagar - Remover seção "Histórico de Pagamentos" (redundante com "Histórico de Fornecedores")
- [x] Documento de Venda - Incluir dados da empresa (Razão Social, Endereço, CNPJ)
- [x] Documento de Venda - Mostrar nome do usuário que gerou a venda
- [x] Tela de Compras - Auto-scroll para linha do novo produto ao adicionar (já estava implementado)
- [x] Tela de Compras - Exibir subtotal (Qtd × Preço Unit.) em cada linha de produto

### Ajuste de Impressão (28/12/2025)
- [x] Adaptar comprovante de venda para impressora térmica 56mm (layout otimizado para largura reduzida)
