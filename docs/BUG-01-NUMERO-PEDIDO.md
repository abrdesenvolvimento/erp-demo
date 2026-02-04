# BUG-01: Número do Pedido (Delivery) não carrega/salva na edição

## Problema Identificado

Ao editar uma venda do tipo Delivery, o campo `platformOrderId` (número do pedido) não está sendo:
1. Carregado corretamente quando a venda é aberta para edição
2. Salvo corretamente quando a edição é confirmada

## Análise Técnica

### Diagnóstico

1. **Frontend (SaleDetailsModal.tsx)**:
   - O campo `editedOrderNumber` é inicializado com `(saleData as any).orderNumber` (linha 96)
   - Porém, o campo no banco se chama `platformOrderId`, não `orderNumber`
   - A mutation envia `orderNumber` mas o backend espera `platformOrderId`

2. **Backend (routers.ts)**:
   - O endpoint `sales.update` recebe `orderNumber` no input (linha 634)
   - Mas a função `updateSale` no db.ts não aceita `platformOrderId` como parâmetro

3. **Banco de dados**:
   - A tabela `sales` tem o campo `platformOrderId` (varchar 100)
   - A função `getSale` retorna `platformOrderId` corretamente

### Problema Raiz

Há uma inconsistência de nomenclatura:
- Schema: `platformOrderId`
- Frontend: `orderNumber` / `editedOrderNumber`
- Backend mutation: `orderNumber`
- Função updateSale: não aceita o campo

## Solução Proposta (Patch Semantics)

### 1. Atualizar função `updateSale` no db.ts

```typescript
// server/db.ts - linha ~3180
export async function updateSale(saleId: number, data: {
  subtotal?: string;
  discountAmount?: string;
  surchargeAmount?: string;
  finalAmount?: string;
  platformOrderId?: string;  // ADICIONAR
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  
  await database.update(sales)
    .set(data)
    .where(eq(sales.id, saleId));
}
```

### 2. Atualizar endpoint `sales.update` no routers.ts

```typescript
// server/routers.ts - linha ~712
// Alterar de:
...(orderNumber !== undefined && { orderNumber }),

// Para:
...(orderNumber !== undefined && { platformOrderId: orderNumber }),
```

### 3. Corrigir inicialização no frontend (SaleDetailsModal.tsx)

```typescript
// client/src/components/SaleDetailsModal.tsx - linha ~96
// Alterar de:
setEditedOrderNumber((saleData as any).orderNumber || "");

// Para:
setEditedOrderNumber(saleData.platformOrderId || "");
```

### 4. Exibir número do pedido no modo visualização

Adicionar no cabeçalho da venda (após linha ~530):

```tsx
{saleData.saleType === 'DELIVERY' && saleData.platformOrderId && (
  <div>
    <p className="text-sm text-muted-foreground">Nº Pedido</p>
    <p className="font-semibold">{saleData.platformOrderId}</p>
  </div>
)}
```

## Impacto

- **Risco**: Baixo - alteração pontual em 3 arquivos
- **Regressão**: Nenhuma - apenas corrige funcionalidade existente
- **Migração**: Não necessária - dados existentes já estão corretos no banco

## Testes Recomendados

1. Criar venda Delivery com número de pedido → verificar se salva
2. Abrir venda Delivery existente → verificar se exibe número
3. Editar venda Delivery → verificar se carrega e salva número
4. Editar venda Balcão → verificar que não mostra campo de número

## Estimativa

- **Tempo**: 30 minutos
- **Complexidade**: Baixa
