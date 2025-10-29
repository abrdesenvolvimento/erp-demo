# TODO - Sistema ERP Adega Beira Rio

## Bugs Críticos em Correção

- [x] Reverter layout de vendas de 2 colunas para coluna única (formulário no topo, resumo abaixo)
- [x] Corrigir edição de produtos compostos - composições não aparecem ao editar produto existente
- [x] Corrigir baixa de estoque para produtos compostos em vendas (deve deduzir dos componentes, não do composto)
- [x] Implementar cálculo automático de custo para produtos compostos baseado no custo dos componentes

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

