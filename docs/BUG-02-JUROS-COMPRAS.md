# BUG-02: Edição de Compras - Juros não atualiza valores

## Problema Identificado

Ao editar uma compra inserindo juros (chargesCost), o sistema:
1. Não está salvando o novo valor de juros/encargos
2. O total da nota não atualiza após inserção de juros
3. As parcelas não são recalculadas com o novo valor

## Análise Técnica

### Diagnóstico

1. **Endpoint `purchases.update` (routers.ts:909-942)**:
   - Aceita apenas `docType`, `docNumber` e `items`
   - **NÃO aceita** `freightCost` ou `chargesCost` (juros)
   - Não há campo para atualizar encargos/juros

2. **Função `updatePurchaseOrderItems` (db.ts:1264-1373)**:
   - Recalcula `totalAmount` somando itens + frete + encargos existentes
   - Mas os valores de frete/encargos vêm do banco (valores antigos)
   - Não recebe novos valores de frete/encargos como parâmetro

3. **Fluxo atual**:
   ```
   Frontend envia: { id, items, docType, docNumber }
   Backend calcula: totalAmount = soma(itens) + frete_antigo + encargos_antigos
   Resultado: Juros novos não são considerados
   ```

### Problema Raiz

O endpoint de update não aceita campos `freightCost` e `chargesCost`, então mesmo que o frontend envie, o backend ignora.

## Solução Proposta

### 1. Atualizar endpoint `purchases.update` no routers.ts

```typescript
// server/routers.ts - linha ~909
update: adminProcedure
  .input(z.object({
    id: z.number(),
    docType: z.enum(["NOTA_FISCAL", "CUPOM", "SEM_DOCUMENTO"]).optional(),
    docNumber: z.string().optional(),
    freightCost: z.string().optional(),    // ADICIONAR
    chargesCost: z.string().optional(),    // ADICIONAR (juros/encargos)
    items: z.array(z.object({
      productId: z.number(),
      quantity: z.string(),
      unitCost: z.string(),
      expiryDate: z.string().optional().nullable(),
    })),
  }))
  .mutation(async ({ input }) => {
    const { id, items, docType, docNumber, freightCost, chargesCost } = input;
    
    // Atualizar dados da compra (patch semantics)
    const updateData: any = {};
    if (docType !== undefined) updateData.docType = docType;
    if (docNumber !== undefined) updateData.docNumber = docNumber;
    if (freightCost !== undefined) updateData.freightCost = freightCost;
    if (chargesCost !== undefined) updateData.chargesCost = chargesCost;
    
    if (Object.keys(updateData).length > 0) {
      await db.updatePurchaseOrder(id, updateData);
    }
    
    // Atualizar itens (passa os novos valores de frete/encargos)
    const itemsWithDates = items.map(item => ({
      ...item,
      expiryDate: item.expiryDate ? new Date(item.expiryDate) : null
    }));
    
    await db.updatePurchaseOrderItems(id, itemsWithDates, {
      freightCost: freightCost ? parseFloat(freightCost) : undefined,
      chargesCost: chargesCost ? parseFloat(chargesCost) : undefined,
    });
    
    return { success: true };
  }),
```

### 2. Atualizar função `updatePurchaseOrderItems` no db.ts

```typescript
// server/db.ts - linha ~1264
export async function updatePurchaseOrderItems(
  purchaseOrderId: number, 
  items: Array<{
    id?: number;
    productId: number;
    quantity: string;
    unitCost: string;
    expiryDate?: Date | null;
  }>,
  costs?: {
    freightCost?: number;
    chargesCost?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // ... código existente de validação e processamento de itens ...
  
  // Calcular total dos itens
  let totalAmount = 0;
  for (const item of items) {
    const quantity = parseFloat(item.quantity);
    const unitCost = parseFloat(item.unitCost);
    totalAmount += quantity * unitCost;
    // ... resto do processamento de itens ...
  }
  
  // Usar novos valores de frete/encargos se fornecidos, senão usar valores do banco
  const po = await getPurchaseOrderById(purchaseOrderId);
  const freightCost = costs?.freightCost ?? parseFloat(po.purchaseOrder.freightCost?.toString() || "0");
  const chargesCost = costs?.chargesCost ?? parseFloat(po.purchaseOrder.chargesCost?.toString() || "0");
  
  totalAmount += freightCost + chargesCost;
  
  // Atualizar valor total da compra
  await updatePurchaseOrder(purchaseOrderId, { totalAmount: totalAmount.toFixed(2) });
  
  // Atualizar parcelas em Contas a Pagar (recalcular com novo total)
  // ... código existente de atualização de parcelas ...
}
```

### 3. Verificar frontend de edição de compras

Verificar se o frontend envia `freightCost` e `chargesCost` na mutation de update. Se não enviar, adicionar os campos.

## Considerações do Orion

Conforme diretrizes:
- **Transação atômica**: Todo o update (itens + custos + parcelas) deve ser uma transação
- **Valores em centavos**: Considerar armazenar valores como inteiros (centavos) para evitar erros de ponto flutuante
- **Patch semantics**: Só atualizar campos que foram explicitamente passados

## Impacto

- **Risco**: Médio - alteração em lógica de cálculo financeiro
- **Regressão**: Testar edição de compras sem juros para garantir que continua funcionando
- **Migração**: Não necessária

## Testes Recomendados

1. Criar compra sem juros → Editar adicionando juros → Verificar total e parcelas
2. Criar compra com juros → Editar alterando juros → Verificar total e parcelas
3. Criar compra com juros → Editar sem alterar juros → Verificar que mantém valor original
4. Editar compra alterando apenas itens → Verificar que juros existentes são mantidos

## Estimativa

- **Tempo**: 1-2 horas
- **Complexidade**: Média
