# Análise do Bug - Card Mg Líquida Delivery

## Problema Identificado
O card mostra:
- Margem: 20.9%
- Faturamento: R$ 119,74

Mas o dashboard mostra:
- Delivery no mês: R$ 3.022,86 (18% do faturamento total)

## Causa Provável
O endpoint `deliveryNetMargin` está filtrando por mês usando JavaScript, mas pode estar usando timezone incorreto ou comparando datas de forma errada.

O código atual usa:
```javascript
const todayDateStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' });
```

Isso pode estar causando problemas porque:
1. O servidor pode estar em UTC
2. A comparação de mês/ano pode estar errada

## Solução
Usar a mesma lógica de timezone que funciona no calendário de vendas.
