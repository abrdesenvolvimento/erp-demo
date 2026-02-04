# BUG-04: Produtos Duplicados em Compras

## Descrição do Problema
Atualmente, ao adicionar produtos em uma compra, o usuário pode selecionar o mesmo produto múltiplas vezes no autocomplete. Embora a função `handleAddItem` já incremente a quantidade se o produto já existir, a experiência do usuário é confusa pois o produto continua aparecendo nas sugestões.

## Comportamento Atual
```tsx
// Linha 109-112: searchResults vem do backend sem filtro
const { data: searchResults = [] } = trpc.purchases.searchProducts.useQuery(
  { search: searchTerm },
  { enabled: searchTerm.length >= 2 }
);

// Linha 610-625: Todos os resultados são exibidos
{searchResults.map((product) => (
  <button
    key={product.id}
    onClick={() => handleAddItem(product)}
    className="w-full text-left px-4 py-2 hover:bg-muted..."
  >
    ...
  </button>
))}
```

## Comportamento Esperado
Produtos já adicionados à lista de itens NÃO devem aparecer nas sugestões do autocomplete.

## Solução Proposta

### Opção A: Filtro no Frontend (Recomendada)
Filtrar os resultados antes de renderizar, excluindo produtos que já estão em `items`.

**Vantagens:**
- Implementação simples e localizada
- Não requer alteração no backend
- Resposta imediata (sem nova requisição)

**Código:**
```tsx
// Criar variável derivada com produtos filtrados
const filteredSearchResults = searchResults.filter(
  product => !items.some(item => item.productId === product.id)
);

// Usar filteredSearchResults no render
{searchTerm && filteredSearchResults.length > 0 && (
  <div className="absolute top-full...">
    {filteredSearchResults.map((product) => (
      ...
    ))}
  </div>
)}
```

### Opção B: Filtro no Backend
Passar IDs dos produtos já selecionados para o endpoint excluir da query.

**Vantagens:**
- Menos dados trafegados
- Útil se a lista de produtos for muito grande

**Desvantagens:**
- Requer alteração no backend
- Mais complexo
- Requisição a cada mudança na lista de itens

**Não recomendada** para este caso, pois a lista de resultados já é limitada e o filtro no frontend é suficiente.

## Implementação Detalhada (Opção A)

### Arquivo: `client/src/pages/Compras.tsx`

**Alteração 1:** Adicionar variável derivada após a query (linha ~113)
```tsx
// Filtrar produtos já adicionados à compra
const filteredSearchResults = searchResults.filter(
  product => !items.some(item => item.productId === product.id)
);
```

**Alteração 2:** Substituir `searchResults` por `filteredSearchResults` no render (linha ~610)
```tsx
// Antes:
{searchTerm && searchResults.length > 0 && (

// Depois:
{searchTerm && filteredSearchResults.length > 0 && (
```

**Alteração 3:** Substituir no map (linha ~612)
```tsx
// Antes:
{searchResults.map((product) => (

// Depois:
{filteredSearchResults.map((product) => (
```

## Testes Manuais
1. Abrir formulário de nova compra
2. Buscar um produto (ex: "Heineken")
3. Adicionar o produto à lista
4. Buscar novamente o mesmo produto
5. **Esperado:** O produto NÃO deve aparecer nas sugestões
6. Remover o produto da lista
7. Buscar novamente
8. **Esperado:** O produto DEVE aparecer nas sugestões

## Impacto
- **Risco:** Baixo
- **Escopo:** Apenas frontend, módulo de Compras
- **Tempo estimado:** 15 minutos

## Checklist de Implementação
- [x] Adicionar variável `filteredSearchResults` com useMemo
- [x] Substituir `searchResults` por `filteredSearchResults` no JSX
- [x] Testar cenário de adicionar/remover produto
- [x] Atualizar todo.md
- [x] Criar checkpoint

---
**Autor:** Aurora (Manus AI)
**Data:** 2026-02-04
**Status:** Implementado e testado
