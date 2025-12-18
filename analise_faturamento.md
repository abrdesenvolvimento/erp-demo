# Análise da Divergência de Faturamento

## Valores Observados no Dashboard:
- **Faturamento Mês (card)**: R$ 67.541,03
- **Faturamento Total (Margem Bruta)**: R$ 67.846,34

## Diferença: R$ 305,31

## Possíveis Causas:

### 1. Metodologia de Cálculo Diferente
- **Faturamento Mês (dashboard.stats)**: Usa `sale.finalAmount` (valor final da venda)
- **Margem Bruta (getGrossMarginByCategory)**: Usa `quantity * unitPrice` dos itens de venda

### 2. Descontos e Ajustes
- O `finalAmount` pode incluir descontos aplicados na venda
- O cálculo da margem usa `unitPrice` dos itens, que é o preço antes de descontos

### 3. Verificação Necessária
- Verificar se há vendas com desconto que causam a diferença
- O cálculo da margem deveria usar `finalAmount` ou o valor dos itens?

## Solução Proposta
Ajustar o cálculo da Margem Bruta para usar o mesmo valor base do Faturamento Mês,
considerando descontos proporcionalmente distribuídos entre os itens.
