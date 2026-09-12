# Conciliação iFood — Adega — Agosto de 2026

## Escopo e salvaguardas

Este documento registra um diagnóstico somente leitura dos pedidos do iFood da Adega Beira Rio (`companyId = 1`) em agosto de 2026. Nenhuma venda, item, estoque, recebível, caixa ou lançamento contábil foi alterado nesta etapa.

A correção preventiva do importador foi implementada separadamente: o servidor normaliza quantidade e preço unitários, revalida os dados recebidos no momento da importação e bloqueia identificadores externos completos repetidos dentro do lote. O código curto exibido pelo iFood não deve ser usado sozinho como chave de idempotência.

## Evidências confirmadas

O diagnóstico anterior encontrou 1.175 vendas Delivery da Adega em agosto, totalizando R$ 53.770,90. Dessas vendas, 1.148 possuíam vínculo com o registro do importador iFood e 27 não possuíam vínculo. Esses números são inventário da base e não representam, por si só, quantidade de pedidos oficiais.

O caso 0203 foi confirmado como candidato composto por duas anomalias: o iFood enviou uma composição de combo que foi interpretada com valor agregado como se fosse preço unitário, e o código curto 0203 aparece em seis vendas no mesmo instante (08/08/2026 às 20:06:05). A base mostra seis vendas de R$ 532,23. O detalhamento informado pelo gestor indica 24 unidades de Amstel 269 ml a R$ 3,39, total correto de R$ 81,36. A diferença entre R$ 522,23 e R$ 532,23 deve ser confirmada no arquivo oficial antes de qualquer correção; a base consultada registra R$ 532,23.

Na consulta de divergência entre o total da venda e a soma de `quantity × unitPrice`, apareceram, entre os candidatos principais, quatro registros do grupo 0203 com diferenças de R$ 44,07, R$ 44,07, R$ 44,07 e R$ 40,68, além de um registro do código 3044 em 24/08/2026 com diferença de R$ 6,59. A consulta ampla também retornou muitos pedidos com mais de uma linha e diferença zero; esses casos não devem ser classificados como duplicidade ou erro apenas por possuírem vários itens.

## Classificação necessária antes do saneamento

| Classe | Critério de confirmação | Ação proposta, ainda não executada |
|---|---|---|
| Combo inflado | Arquivo oficial mostra total do combo em campo tratado como unitário; recomposição unitária fecha com quantidade e preço oficial | Corrigir composição dos itens e total, preservando auditoria |
| Duplicidade real | Mesmo identificador externo completo, ou evidência independente do mesmo pedido importado mais de uma vez | Manter um registro canônico e cancelar administrativamente os excedentes, com motivo |
| Código curto repetido legítimo | Código curto igual, mas identificador completo, horário, itens ou valor oficial diferentes | Não cancelar automaticamente |
| Divergência não explicada | Total, itens ou identificador não fecham com a fonte oficial | Manter pendente para conferência manual |
| Venda sem vínculo de importação | Venda Delivery sem registro correspondente em `ifoodImports` | Comparar com o JSON e não corrigir por inferência |

## Plano de saneamento de agosto

A etapa histórica deve começar pela obtenção do JSON original do iFood, preferencialmente com os arquivos de pedidos e itens. Para cada pedido, será montada uma chave de reconciliação com identificador completo, data de negócio, valor oficial, itens, quantidades e composição de combo. Em seguida, será produzido um relatório antes/depois por venda, incluindo impactos em estoque, recebíveis, caixa, CMV, DRE e contabilidade.

Nenhuma correção histórica deve ser executada apenas com base no código curto 0203 ou em agrupamento por horário e valor. A aprovação deve ocorrer caso a caso ou por lote homogêneo claramente documentado. Estornos e alterações de vendas são operações financeiras e devem ser revisados pelo responsável antes da aplicação.

## Estado atual

A proteção preventiva está em checkpoint `44f39c08`. Os testes do normalizador unitário passaram em 4 de 4 casos. O saneamento histórico de agosto continua pendente de confirmação com a fonte oficial e de aprovação dos casos classificados.
