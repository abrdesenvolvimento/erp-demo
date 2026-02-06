# Debug Notes - Importador iFood

## Problemas Identificados

### 1. Modal de Divergência de Valor
- O modal está aparecendo, mas o layout parece estar "quebrado" conforme mencionado pelo usuário
- O modal está mostrando apenas um item com divergência (Coca Cola 2l)
- O botão "Corrigir Preço" está visível

### 2. Erro na Importação
- Ao clicar em "Importar Selecionados", nada acontece
- Não há requisições de rede sendo feitas
- Os logs de debug não estão aparecendo no console

### 3. Atualização de Preço do Canal
- Precisa verificar se a mutation updateChannelPrice está funcionando corretamente

## Próximos Passos
1. Verificar se há erro no código do modal
2. Verificar a função handleImportOrders
3. Testar a mutation de atualização de preço
