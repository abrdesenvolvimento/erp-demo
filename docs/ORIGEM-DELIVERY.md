# Origem das vendas delivery

## Escolha na entrada

A origem é definida na criação da venda manual ou no importador da plataforma. As opções são **iFood**, **99Food**, **Próprio** e **Outro**. A interface não oferece edição posterior exclusiva de plataforma. O importador 99Food continua sendo uma etapa futura.

Há três informações diferentes: `channelId` é o canal utilizado para preços, comissão e contabilização; `deliveryPlatform` é a origem; `platformOrderId` é o código que o operador digita, exibido como **Pedido**. A inclusão da origem não altera a tabela de preços nem as taxas do canal.

Quando o operador seleciona um canal explicitamente cadastrado com código `IFOOD` ou `99FOOD`, a interface preenche a plataforma correspondente. Canais genéricos não permitem presumir origem: a escolha de plataforma permanece necessária. A criação é revalidada no servidor, incluindo o vínculo empresarial do canal e a compatibilidade entre canal identificado e plataforma selecionada.

O importador iFood grava `deliveryPlatform: "IFOOD"` somente nas novas vendas; mantém as regras existentes de UUID, bloqueio de duplicidades e normalização de combos. Vendas Balcão, A Prazo e Salão não são classificadas como delivery.

## Leitura de vendas existentes, sem reprocessamento

As consultas fornecem tanto a plataforma **armazenada** quanto a **efetiva**, usada na exibição e nos filtros. A precedência é:

1. Plataforma válida armazenada na venda.
2. Quando o campo é nulo, importação iFood comprovada por UUID completo, venda e empresa coincidentes.
3. Sem as anteriores, canal vinculado à venda e à mesma empresa, com código **exatamente** `IFOOD` ou `99FOOD`.
4. Sem evidência suficiente: **Não informada**.

A terceira regra corrige a omissão identificada em 08/11/2026: a escolha manual de **Delivery 99Food** estava preservada no canal, mas a leitura anterior não a reconhecia quando a coluna nova era nula. Isso não usa correspondência aproximada de nomes, observações ou códigos curtos de pedido. Um canal de outra empresa não autoriza classificação; um canal apenas `DELIVERY` permanece genérico. A plataforma armazenada prevalece sobre as demais evidências.

A resolução é feita em **SELECT**. Não atualiza históricos, não altera valores, datas, itens, estoque ou lançamentos financeiros. Evidências são obtidas sem JOIN que multiplique as vendas. A informação desconhecida não é convertida automaticamente em 99Food.

## Filtros, indicadores e exportação

A mesma resolução efetiva atende a lista, detalhes, indicadores e exportação funcional da página Vendas; Análise de Vendas; e Análise Delivery, incluindo os pedidos usados no rateio das taxas fixas. **Não informada** significa ausência de origem efetiva. Uma venda reconhecida pelo canal explícito já pode ser filtrada em 99Food sem gravar uma nova classificação.

As consultas mantêm a empresa ativa como autorização. Entradas de empresa utilizadas nas análises servem também para segregação do cache e são conferidas contra o contexto no servidor. As vendas mantêm o alcance empresarial existente, sem acrescentar uma restrição artificial de filial.

A listagem continua exibindo cancelamentos, enquanto indicadores e exportação respeitam as exclusões já previstas. O limite da lista, as definições de receita e CMV, os períodos em Brasília e as taxas por canal não são redefinidos por esta melhoria. Busca e status de margem locais da Análise Delivery continuam locais, como antes. Os botões de exportação sem handler da Análise de Vendas não foram implementados nesta rodada.

## Alteração posterior

O botão e o modal **Editar plataforma** foram retirados, assim como o endpoint dedicado. A atualização geral da venda não pode ser usada para trocar exclusivamente a plataforma. A ausência do campo numa edição convencional preserva a origem armazenada. Não é necessário alterar a plataforma dos pedidos do print para que a leitura reconheça o canal 99Food já escolhido.

## Validação

Os testes de `server/deliveryPlatform*.test.ts` usam funções puras, SQL compilado/mockado e contratos tRPC/JSX, sem gravar vendas. Cobrem seleção na criação, precedência, canal explícito versus canal genérico, escopo da empresa, UUID, rejeição de plataforma incompatível, ausência de edição posterior e paridade de filtros nos agregados.

```bash
pnpm vitest run server/deliveryPlatform*.test.ts server/salesCompanyIsolation.test.ts server/ifoodPricing.test.ts
```

A conferência `scripts/verify-manual-99food-readonly.ts` executa apenas leituras dos oito pedidos enviados pelo usuário, dos detalhes e dos filtros/indicadores/exportação/análises. Não importa novamente nem modifica vendas. Os testes de navegador usam APIs fictícias, e seus arquivos temporários públicos são removidos antes da entrega.

O TypeScript global tem diagnósticos anteriores fora desta melhoria. Build e testes focados não equivalem à aprovação global do typecheck.
