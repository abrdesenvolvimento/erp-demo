# Origem das vendas delivery

## Contrato e seleção

`sales.deliveryPlatform` é um `varchar(32)` anulável, separado de `channelId` (canal de preço, comissão e contabilização) e `platformOrderId` (identificador exibido como **Pedido**). As plataformas permitidas são `IFOOD`, `99FOOD`, `PROPRIO` e `OUTRO`; os rótulos são iFood, 99Food, Próprio e Outro. Não há criação de canais nem importador/API 99Food nesta entrega.

A nova venda manual DELIVERY exige uma seleção explícita, tanto na UI quanto no servidor; não existe default iFood. O campo é opcional no contrato TypeScript para preservar callers antigos de outros tipos. BALCAO, SALAO e A_PRAZO gravam NULL. O importador iFood inclui `deliveryPlatform: "IFOOD"` apenas no INSERT das novas vendas e mantém inalteradas as regras de combos, normalização de valores e idempotência.

## Históricos: informação armazenada versus efetiva

A migração da coluna pertence à entrega principal. Ela não deve fazer backfill nem executar UPDATE em vendas existentes. Nenhum banco real foi acessado ou alterado durante esta implementação.

As leituras retornam `deliveryPlatform` (valor armazenado) e `effectiveDeliveryPlatform` (origem de exibição/filtro). Para DELIVERY, a plataforma armazenada válida tem prioridade. Somente quando o campo armazenado é NULL, a existência de registro em `ifoodImportedOrders` com **UUID iFood válido**, **mesmo saleId** e **mesma companyId** permite exibir iFood. A existência é calculada com `EXISTS`, não JOIN, evitando duplicação de vendas por múltiplas evidências.

Filial não restringe essa leitura: vendas e indicadores mantêm o padrão empresarial atual, incluindo todas as filiais da empresa ativa. A evidência legada não atravessa empresas. Registros de importação sem empresa, sem saleId ou sem UUID não são prova suficiente. Nome/código de canal, `channelId`, código curto do Pedido e observações não são usados para inferir origem. Vendas sem evidência continuam **Não informada**, nunca presumidas como 99Food. Tipos não DELIVERY não exibem plataforma.

A resolução é apenas SELECT; ela não escreve a origem inferida, não modifica Pedido/canal e não altera valores, datas, itens, estoque ou contabilização dos históricos.

## Filtros e exportação

`sales.list`, `sales.stats` e `sales.exportSales` aceitam `deliveryPlatform` com as quatro plataformas ou `NAO_INFORMADO`. A última opção filtra NULL **efetivo**: um legado com importação iFood comprovada entra em iFood, não em Não informada. A mesma função `deliveryPlatformFilterSql` é usada nos três caminhos, com a mesma precedência e escopo. A UI envia o mesmo filtro aos três endpoints e o Excel inclui Plataforma e Pedido.

Quando há filtro de plataforma, somente DELIVERY é elegível; combinar plataforma com outro tipo resulta em conjunto vazio. Sem filtro, todos os tipos permanecem elegíveis. Listagem mantém canceladas para operação, enquanto indicadores e exportação excluem canceladas conforme a regra preexistente. O limite da listagem continua 500 por padrão; os indicadores agregam o período completo. Nenhuma dessas diferenças preexistentes é redefinida pela origem.

**Extensão autorizada nas análises:** todos os endpoints de `salesAnalysis.*` aceitam o mesmo `deliveryPlatform` opcional: resumo (com ou sem filtro de produtos), contagem por canal, valores, quantidades e denominador do mix, categorias, dia, semana, mês, matriz produto × data e comparação de períodos. Na comparação, ambos os períodos e ambos os totais recebem os mesmos filtros. O predicado compartilha a resolução efetiva das vendas, inclusive nas subconsultas. Nenhuma origem é inferida pelo canal.

AnáliseVendas oferece **Origem do delivery** separada do canal e do pagamento, com limpeza do filtro. Seus payloads são memoizados e incluem `companyId` para separar o cache por empresa; o servidor exige empresa ativa e rejeita divergência entre o input e o contexto. O input nunca autoriza consulta a outra empresa. Todos os conjuntos disponibilizados para tabelas e eventual exportação já estão filtrados, sem consulta alternativa não filtrada. Os dois botões **Exportar** desta página já não possuíam handler; a extensão de origem não implementa esse recurso ausente. A exportação funcional da página Vendas permanece coberta por `sales.exportSales`.

AnaliseDelivery aplica a origem em `dashboard.deliveryProductAnalysis`: produtos e contagem de pedidos para taxas fixas usam o mesmo recorte de origem. Os cards da página são derivados desses produtos, não de um overview ou série semanal independente. A consulta de configuração do canal também é limitada à empresa ativa. A remoção de categoria da contagem de pedidos, usada previamente no rateio de taxa fixa, é preservada; ela não remove o filtro de origem. Busca textual e status de margem continuam filtros locais da tabela, não dos cards, como antes. Limpar Filtros restaura todas as origens, todos os canais e o período padrão.

**Limites restantes:** a extensão não altera outros dashboards, fechamento, relatórios financeiros ou análises externas a esses dois módulos. Não cria importador/API 99Food nem reconstrói origem desconhecida. Mantém integralmente as definições existentes de receita (`finalAmount` no resumo sem produto e `saleItems.totalPrice` nos demais agregados), CMV, margens, cancelamentos, períodos/timezones, comissão/fallback e rateio por canal. Os filtros preexistentes de dias/meses não contíguos e seleções locais de categorias não são redefinidos por esta entrega. Comissões continuam vinculadas ao canal, não à plataforma.

## Edição explícita e auditoria

`sales.update` aceita `deliveryPlatform` como patch opcional. Ausência do campo preserva a plataforma existente, inclusive NULL legado; não deve enviar a plataforma efetiva como valor salvo implicitamente. Tipos não DELIVERY são limpos para NULL. Uma mudança explícita de origem usa o log de auditoria existente.

A página Vendas oferece **Editar plataforma** a administradores. O modal inicializa a partir do campo **armazenado**, não do derivado. Salvar com Não informada em um legado NULL não gera escrita nem auditoria falsa. Escolher uma plataforma explicitamente é uma ação do usuário, aplicada por `sales.updateDeliveryPlatform`, protegida por empresa ativa e perfil administrador e registrada com usuário, campo, valor anterior e novo.

Esse endpoint altera exclusivamente a plataforma; não reprocessa itens, totais, datas, clientes, estoque ou lançamentos. Ele permite corrigir a informação de origem de uma venda antiga sem contornar o limite de 24h para edição financeira da venda. Se o campo for limpo para NULL e houver prova iFood válida, a exibição derivada continuará iFood, conforme aviso no modal. `SaleDetailsModal.tsx` não foi modificado: a ação de plataforma é separada para evitar ampliar escopo ou reprocessar históricos.

O log usa o mecanismo de auditoria já existente no ERP, que registra falhas em log; esta entrega não altera sua garantia transacional.

## Validação segura

Execute somente os testes abaixo para esta funcionalidade. Eles usam funções puras, SQL compilado com Drizzle/mock, chamadas tRPC com helpers mockados, inspeção de contrato frontend e transpile JSX. Não conectam ao banco, não executam importações reais e não usam browser.

```bash
pnpm exec vitest run server/deliveryPlatform*.test.ts server/salesCompanyIsolation.test.ts server/ifoodPricing.test.ts
```

Os testes `server/deliveryPlatformAnalysis*.test.ts` validam a extensão das análises com SQL compilado/mockado, contratos tRPC e avaliação dos payloads memoizados da UI. Cobrem todos os agregados, as duas bases do resumo, mix e subconsulta, comparação de ambos os períodos, recorte dos pedidos/taxas de delivery, preservação de filtros e fórmulas, opção Não informada, limpeza e segregação empresarial do cache. Não há conexão SQL real nem validação por browser.

Os testes cobrem opções, precedência, UUID versus código curto, isolamento empresarial, ausência de inferência por canal, duplicação de evidências, filtro com e sem datas, NULL efetivo, indicadores, exportação, escolha manual obrigatória, limpeza não DELIVERY, preservação de patch, edição metadata-only auditada, permissões e JSX. O check global do projeto apresenta erros preexistentes fora do escopo; não deve ser descrito como totalmente aprovado sem resolver essas pendências separadas.
