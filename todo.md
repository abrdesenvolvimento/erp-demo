# Project TODO

## Bugs Críticos

- [ ] Layout de vendas quebrado no mobile - resumo lateral sobrepondo formulário
- [ ] Edição de produto composto não mostra composições
- [ ] Venda de produto composto não dá baixa nos componentes
- [ ] Erro no cadastro rápido de fornecedor

## Funcionalidades Pendentes

- [ ] Custo automático de produtos compostos baseado nos componentes
- [ ] Histórico de pagamentos não mostra compras (apenas despesas)

## Melhorias de UX (Baixa Prioridade)

- [ ] Tooltips explicativos nos formulários
- [ ] Confirmação antes de deletar registros

## Concluído

- [x] Validação visual de estoque em vendas
- [x] Validação de EAN com dígito verificador
- [x] Validação e formatação de CPF/CNPJ
- [x] Cálculo automático de parcelas em Compras
- [x] Preenchimento automático de parcela única
- [x] Busca automática de CEP
- [x] Filtros em Contas a Receber/Pagar
- [x] Atalhos de teclado globais
- [x] Resumo fixo lateral em vendas (desktop)
- [x] Labels melhorados
- [x] Indicadores visuais de vencimento
- [x] Sincronização com GitHub
- [x] Guia de instalação local


## Sprint Atual (13/11/2025)

- [x] Corrigir subcategorias duplicadas (VInho → Vinho, Ess → Essência)
- [x] Gerar arquivo CSV de produtos para inventário
- [x] Implementar campo "Nome Fantasia" em Parceiros
- [x] Travar campos de endereço após busca de CEP
- [ ] Implementar filtro por subcategoria em Produtos (ADIADO)


## Bugs Identificados em Testes (13/11/2025)

- [x] BUG: Histórico de recebimentos agrupando múltiplos pagamentos em uma única linha (criada tabela receivablePayments)
- [x] BUG: Cliente "Gabriel" não aparece na busca ao registrar venda (filtro modificado para aceitar CUSTOMER ou BOTH)
- [x] MELHORIA: Restringir botão "Desbloquear Campos de Endereço" apenas para usuários admin


## Novo Bug Identificado (13/11/2025 - Tarde)

- [x] BUG: Vendas com saldo devedor não aparecem na tela de Contas a Receber (corrigida lógica de updateReceivableStatus para considerar parcelas PARCIAL)

