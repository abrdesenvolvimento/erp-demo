# Análise de Divergências - Janeiro/2026

## Valores do DRE (após correções)

| Conta | Valor DRE |
|-------|-----------|
| 4 - RECEITA OPERACIONAL BRUTA | R$ 90.503,42 |
| 4.1 - RECEITA OPERACIONAL BRUTA | R$ 90.503,42 |
| 5 - CUSTOS | R$ 54.090,30 |
| 5.1 - CUSTO DAS MERCADORIAS VENDIDAS | R$ 52.907,03 |
| 5.2 - CUSTOS OPERACIONAIS | R$ 1.103,27 |
| 5.3 - MANUTENÇÃO | R$ 80,00 |
| LUCRO BRUTO | R$ 36.413,12 |
| 6 - DESPESAS OPERACIONAIS | R$ 38.630,19 |
| 6.1 - DESPESAS OPERACIONAIS | R$ 31.567,21 |
| 6.3 - DESPESAS FINANCEIRAS | R$ 62,98 |
| 6.4 - DESPESAS COM PESSOAL | R$ 7.000,00 |
| RESULTADO OPERACIONAL | R$ 2.217,07 |

## Valores informados pelo Gabriel (Sistema)

| Conta | Valor Sistema | Valor DRE Anterior | Diferença |
|-------|---------------|-------------------|-----------|
| Balcão | R$ 56.493,25 | R$ 59.978,75 | -R$ 3.485,50 |
| A Prazo | R$ 7.115,40 | R$ 7.270,40 | -R$ 155,00 |
| Delivery | R$ 23.522,32 | R$ 23.281,66 | +R$ 240,66 |
| Custo | R$ 60.193,90 | R$ 52.907,03 | +R$ 7.286,87 |
| Despesas | R$ 39.813,46 | R$ 39.813,46 | R$ 0,00 |

## Correções aplicadas

1. **Limpeza de dados antigos**: Removidos lançamentos de 2022-2025
2. **Uso de finalAmount**: Agora usa `finalAmount` ao invés de `subtotal` para vendas
3. **Mapeamento de contas**: Atualizado mapeamento de contas gerenciais para contábeis corretas
4. **Despesas distribuídas**: Despesas agora vão para contas corretas baseadas no mapeamento

## Novos valores de vendas (usando finalAmount)

| Canal | Valor (finalAmount) |
|-------|---------------------|
| Balcão | R$ 59.970,10 |
| A Prazo | R$ 7.277,40 |
| Delivery | R$ 23.255,92 |
| **Total** | **R$ 90.503,42** |

## Possíveis causas das divergências restantes

1. **Timezone**: Vendas podem estar sendo agrupadas em dias diferentes devido ao fuso horário
2. **Cancelamentos**: Algumas vendas podem ter sido canceladas após o registro
3. **Filtros diferentes**: O sistema pode estar usando filtros diferentes (ex: por data de pagamento vs data de venda)
4. **Compras**: O valor de CMV pode não incluir todas as compras ou usar campo diferente
