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
- [ ] Atualização de custo de produto composto ainda não está funcionando (investigar)
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

