# Análise de Erro - Importador iFood

**Data:** 05 de Fevereiro de 2026  
**Autor:** Manus AI  
**Projeto:** ERP Adega Beira Rio (erp-demo)

---

## 1. Resumo do Problema

O módulo Importador iFood apresenta dois problemas críticos:

1. **Erro de SQL na Importação**: Ao tentar importar pedidos, o sistema retorna o erro:
   > "Failed query: insert into `ifoodImportLogs` (`id`, `importedAt`, `ordersFileName`, `itemsFileName`, `totalOrders`, `importedOrders`, `skippedOrders`, `totalValue`, `status`, `errorMessage`, `createdBy`, `createdAt`) values (default, default, ?, ?, ?, ?, ?, ?, ?, default, ?, default)"

2. **Modal de Divergência de Valor com Layout Quebrado**: O modal está exibindo a tabela sem a coluna "Ação" visível corretamente (conforme screenshot fornecido pelo usuário).

---

## 2. Análise do Erro de SQL

### 2.1 Mensagem de Erro

A mensagem de erro indica que há um problema com a query de INSERT na tabela `ifoodImportLogs`. A query está tentando inserir valores com `default` para campos que não suportam esse valor.

### 2.2 Schema da Tabela (drizzle/schema.ts)

```typescript
// Log de Importações iFood
export const ifoodImportLogs = mysqlTable("ifoodImportLogs", {
  id: int("id").primaryKey().autoincrement(),
  importedAt: timestamp("importedAt").defaultNow(),
  ordersFileName: varchar("ordersFileName", { length: 255 }),
  itemsFileName: varchar("itemsFileName", { length: 255 }),
  totalOrders: int("totalOrders").default(0),
  importedOrders: int("importedOrders").default(0),
  skippedOrders: int("skippedOrders").default(0),
  totalValue: decimal("totalValue", { precision: 15, scale: 2 }),
  status: mysqlEnum("status", ["SUCCESS", "PARTIAL", "FAILED"]).default("SUCCESS"),
  errorMessage: text("errorMessage"),
  createdBy: varchar("createdBy", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow(),
});
```

### 2.3 Código de Insert no Backend (server/routers/ifoodImport.ts)

```typescript
// Criar log de importação
const [logResult] = await db.insert(ifoodImportLogs).values({
  ordersFileName: "upload",
  itemsFileName: "upload",
  totalOrders: input.orders.length,
  importedOrders: 0,
  skippedOrders: 0,
  totalValue: "0.00",
  status: "SUCCESS",
  createdBy: ctx.user.id,
});
const logId = logResult.insertId;
```

### 2.4 Diagnóstico do Problema

O problema está na forma como o Drizzle ORM está gerando a query SQL. A query gerada inclui `default` para os campos `id`, `importedAt`, `errorMessage` e `createdAt`, mas o MySQL pode não estar aceitando essa sintaxe corretamente.

**Possíveis causas:**

| Causa | Descrição | Probabilidade |
|-------|-----------|---------------|
| Versão do MySQL/TiDB | A sintaxe `default` pode não ser suportada da mesma forma em todas as versões | Alta |
| Configuração do Drizzle | O Drizzle pode estar gerando SQL incompatível com o banco de dados | Média |
| Campo `totalValue` | O campo está definido como `decimal` mas está recebendo uma string "0.00" | Média |
| Campo `status` | O enum pode não estar sincronizado com o banco de dados | Baixa |

### 2.5 Solução Proposta

1. **Remover campos com `default` da query**: O Drizzle deveria omitir campos com valores default da query INSERT, não incluí-los com `default`.

2. **Verificar se a tabela existe no banco**: Executar `pnpm db:push` para garantir que o schema está sincronizado.

3. **Alterar o código para não depender de `default`**: Passar valores explícitos para todos os campos.

**Código corrigido sugerido:**

```typescript
// Criar log de importação
const now = new Date();
const [logResult] = await db.insert(ifoodImportLogs).values({
  importedAt: now,
  ordersFileName: "upload",
  itemsFileName: "upload",
  totalOrders: input.orders.length,
  importedOrders: 0,
  skippedOrders: 0,
  totalValue: "0.00",
  status: "SUCCESS",
  errorMessage: null,
  createdBy: ctx.user.id,
  createdAt: now,
});
const logId = logResult.insertId;
```

---

## 3. Análise do Modal de Divergência de Valor

### 3.1 Problema Identificado

Conforme a screenshot fornecida pelo usuário, o modal de "Divergência de Valor" está exibindo a tabela com as colunas:
- Produto
- Preço iFood
- Preço ABRWF
- Diferença
- Ação (com botão "Corrigir Preço")

O layout parece estar funcionando, mas o usuário mencionou que está "quebrado". Possíveis problemas:

1. **Largura do modal insuficiente**: O modal tem `max-w-2xl` que pode não ser suficiente para exibir todas as colunas corretamente.
2. **Responsividade**: Em telas menores, as colunas podem estar se sobrepondo.
3. **z-index**: O modal pode estar atrás de outros elementos.

### 3.2 Código Atual do Modal (client/src/pages/ImportadorIfood.tsx)

```tsx
{/* Modal de Divergência de Valor */}
<Dialog open={!!divergenceModal} onOpenChange={() => setDivergenceModal(null)}>
  <DialogContent className="max-w-2xl z-50">
    <DialogHeader>
      <DialogTitle>Divergência de Valor - Pedido #{divergenceModal?.order.ifoodOrderCode}</DialogTitle>
      <DialogDescription>
        Os preços abaixo estão diferentes entre o iFood e o sistema ABRWF
      </DialogDescription>
    </DialogHeader>
    
    {divergenceModal && (
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Preço iFood</TableHead>
              <TableHead className="text-right">Preço ABRWF</TableHead>
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {divergenceModal.items.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <div>
                    <p className="font-medium">{item.ifoodProductName}</p>
                    <p className="text-sm text-muted-foreground">SKU: {item.ifoodSku}</p>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(item.ifoodPrice)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {item.abrwfPrice ? formatCurrency(item.abrwfPrice) : 'N/A'}
                </TableCell>
                <TableCell className="text-right">
                  {item.divergencePercent && (
                    <Badge className={item.divergencePercent > 0 ? "bg-red-500" : "bg-green-500"}>
                      {item.divergencePercent > 0 ? "+" : ""}{item.divergencePercent.toFixed(1)}%
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {item.productId && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingPrice}
                      onClick={async () => {
                        setUpdatingPrice(true);
                        try {
                          await updateChannelPriceMutation.mutateAsync({
                            productId: item.productId!,
                            channelId: 2, // iFood
                            newPrice: item.ifoodPrice,
                          });
                          toast.success(`Preço atualizado para ${formatCurrency(item.ifoodPrice)}`);
                          // Reprocessar arquivos para atualizar preview
                          if (ordersFile && itemsFile) {
                            await handleProcessFiles();
                          }
                          setDivergenceModal(null);
                        } catch (error: any) {
                          toast.error(error.message || "Erro ao atualizar preço");
                        } finally {
                          setUpdatingPrice(false);
                        }
                      }}
                    >
                      Corrigir Preço
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          <strong>Nota:</strong> Ao clicar em "Corrigir Preço", o preço do canal iFood no sistema ABRWF 
          será atualizado para o valor praticado no iFood.
        </div>
      </div>
    )}
    
    <DialogFooter>
      <Button variant="outline" onClick={() => setDivergenceModal(null)}>
        Fechar
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 3.3 Solução Proposta

1. **Aumentar a largura do modal**: Alterar `max-w-2xl` para `max-w-3xl` ou `max-w-4xl`.

2. **Adicionar scroll horizontal na tabela**: Envolver a tabela em um container com overflow.

**Código corrigido sugerido:**

```tsx
<DialogContent className="max-w-4xl z-50">
  {/* ... */}
  <div className="space-y-4">
    <div className="overflow-x-auto">
      <Table>
        {/* ... */}
      </Table>
    </div>
    {/* ... */}
  </div>
</DialogContent>
```

---

## 4. Código Completo para Referência

### 4.1 Frontend - Função handleImportOrders

```typescript
const handleImportOrders = async () => {
  if (selectedOrders.size === 0) {
    toast.error("Selecione pelo menos um pedido para importar");
    return;
  }

  // Verificar se há pedidos com produtos não localizados
  const ordersWithMissingProducts = previewData?.orders.filter(
    (o) => selectedOrders.has(o.ifoodOrderId) && o.status === "missing_product"
  );

  if (ordersWithMissingProducts && ordersWithMissingProducts.length > 0) {
    toast.error("Há pedidos selecionados com produtos não localizados. Resolva o De/Para antes de importar.");
    return;
  }

  setIsImporting(true);
  try {
    const ordersToImport = previewData?.orders.filter((o) => selectedOrders.has(o.ifoodOrderId)) || [];
    
    const result = await importOrdersMutation.mutateAsync({
      orders: ordersToImport,
    });

    toast.success(`${result.importedCount} pedidos importados com sucesso!`);
    
    // Limpar estado
    setPreviewData(null);
    setSelectedOrders(new Set());
    setOrdersFile(null);
    setItemsFile(null);
    setActiveTab("historico");
    
    // Atualizar histórico
    utils.ifoodImport.listImportHistory.invalidate();
  } catch (error: any) {
    toast.error(error.message || "Erro ao importar pedidos");
  } finally {
    setIsImporting(false);
  }
};
```

### 4.2 Backend - Mutation importOrders

```typescript
// Importar pedidos selecionados
importOrders: adminProcedure
  .input(z.object({
    orders: z.array(z.object({
      ifoodOrderId: z.string(),
      ifoodOrderCode: z.string(),
      orderDate: z.string(),
      totalValue: z.number(),
      paymentMethod: z.string().optional(),
      items: z.array(z.object({
        ifoodSku: z.string(),
        ifoodProductName: z.string(),
        quantity: z.number(),
        ifoodPrice: z.number(),
        productId: z.number().nullable(),
        productName: z.string().nullable().optional(),
        abrwfPrice: z.number().nullable().optional(),
        hasPriceDivergence: z.boolean().optional(),
        divergencePercent: z.number().nullable().optional(),
        isMapped: z.boolean().optional(),
      })),
    })),
  }))
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar log de importação
    const [logResult] = await db.insert(ifoodImportLogs).values({
      ordersFileName: "upload",
      itemsFileName: "upload",
      totalOrders: input.orders.length,
      importedOrders: 0,
      skippedOrders: 0,
      totalValue: "0.00",
      status: "SUCCESS",
      createdBy: ctx.user.id,
    });
    const logId = logResult.insertId;

    let importedCount = 0;
    let totalValue = 0;
    const errors: string[] = [];

    for (const order of input.orders) {
      try {
        // Verificar se já foi importado
        const [existing] = await db.select()
          .from(ifoodImportedOrders)
          .where(eq(ifoodImportedOrders.ifoodOrderId, order.ifoodOrderId))
          .limit(1);

        if (existing) {
          continue; // Pular se já importado
        }

        // Calcular totais
        const subtotal = order.items.reduce((sum, item) => sum + (item.ifoodPrice * item.quantity), 0);

        // Criar venda
        const [saleResult] = await db.insert(sales).values({
          saleType: "DELIVERY",
          saleDate: new Date(order.orderDate),
          customerId: IFOOD_CUSTOMER_ID,
          channelId: IFOOD_CHANNEL_ID,
          platformOrderId: order.ifoodOrderId,
          subtotal: subtotal.toFixed(2),
          discountAmount: "0.00",
          surchargeAmount: "0.00",
          finalAmount: subtotal.toFixed(2),
          paymentMethod: "Pago na Plataforma",
          notes: `Importado iFood - Pedido #${order.ifoodOrderCode}`,
          status: "ACTIVE",
          createdBy: ctx.user.id,
        });
        const saleId = saleResult.insertId;

        // Criar itens da venda
        for (const item of order.items) {
          // Validar se o item tem productId válido
          if (!item.productId) {
            throw new Error(`Produto "${item.ifoodProductName}" não está mapeado no De/Para`);
          }

          await db.insert(saleItems).values({
            saleId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.ifoodPrice.toFixed(2),
            totalPrice: (item.ifoodPrice * item.quantity).toFixed(2),
          });

          // Baixar estoque
          await db.insert(productMovements).values({
            productId: item.productId,
            date: new Date(order.orderDate),
            type: "SAIDA",
            quantity: (-item.quantity).toString(),
            documentNumber: `IFOOD-${order.ifoodOrderCode}`,
            userId: ctx.user.id,
            notes: `Venda iFood #${order.ifoodOrderCode}`,
          });

          // Atualizar estoque do produto
          await db.update(products)
            .set({
              currentStock: sql`${products.currentStock} - ${item.quantity}`,
            })
            .where(eq(products.id, item.productId));

          // Registrar divergência de preço se houver
          if (item.hasPriceDivergence && item.abrwfPrice) {
            await db.insert(ifoodPriceDivergences).values({
              ifoodOrderId: order.ifoodOrderId,
              productId: item.productId,
              ifoodPrice: item.ifoodPrice.toFixed(2),
              abrwfPrice: item.abrwfPrice.toFixed(2),
              divergencePercent: item.divergencePercent?.toFixed(2) || "0",
            });
          }
        }

        // Registrar pedido importado
        await db.insert(ifoodImportedOrders).values({
          ifoodOrderId: order.ifoodOrderId,
          ifoodOrderCode: order.ifoodOrderCode,
          saleId,
          importLogId: logId,
        });

        importedCount++;
        totalValue += subtotal;
      } catch (error: any) {
        errors.push(`Pedido ${order.ifoodOrderCode}: ${error.message}`);
      }
    }

    // Atualizar log
    await db.update(ifoodImportLogs)
      .set({
        importedOrders: importedCount,
        skippedOrders: input.orders.length - importedCount,
        totalValue: totalValue.toFixed(2),
        status: errors.length > 0 ? (importedCount > 0 ? "PARTIAL" : "FAILED") : "SUCCESS",
        errorMessage: errors.length > 0 ? errors.join("; ") : null,
      })
      .where(eq(ifoodImportLogs.id, logId));

    return {
      importedCount,
      totalValue,
      errors,
    };
  }),
```

---

## 5. Passos para Correção

### 5.1 Corrigir Erro de SQL

1. Abrir o arquivo `server/routers/ifoodImport.ts`
2. Localizar a linha 538 (aproximadamente)
3. Alterar o código de insert para incluir valores explícitos:

```typescript
// Criar log de importação
const now = new Date();
const [logResult] = await db.insert(ifoodImportLogs).values({
  importedAt: now,
  ordersFileName: "upload",
  itemsFileName: "upload",
  totalOrders: input.orders.length,
  importedOrders: 0,
  skippedOrders: 0,
  totalValue: "0.00",
  status: "SUCCESS",
  errorMessage: null,
  createdBy: ctx.user.id,
  createdAt: now,
});
```

### 5.2 Corrigir Modal de Divergência

1. Abrir o arquivo `client/src/pages/ImportadorIfood.tsx`
2. Localizar a linha 694 (aproximadamente)
3. Alterar `max-w-2xl` para `max-w-4xl`
4. Adicionar `overflow-x-auto` ao container da tabela

### 5.3 Sincronizar Schema

Executar o comando para garantir que o schema está sincronizado:

```bash
cd /home/ubuntu/erp-demo && pnpm db:push
```

---

## 6. Observações Adicionais

### 6.1 Problema com Cliques nos Botões

Durante a investigação, foi identificado que os botões "Importar" e "Importar Selecionados" não estavam disparando as funções do React corretamente. Isso pode estar relacionado a:

1. **Hot Module Replacement (HMR) do Vite**: As mudanças no código podem não estar sendo aplicadas corretamente.
2. **Problema de estado do React**: O estado do componente pode estar inconsistente.
3. **Problema de propagação de eventos**: O clique pode estar sendo interceptado por outro elemento.

### 6.2 Recomendações

1. **Reiniciar o servidor de desenvolvimento** após fazer as correções.
2. **Limpar o cache do navegador** (Ctrl+Shift+R) para garantir que o código mais recente seja carregado.
3. **Verificar os logs do servidor** para identificar erros adicionais.

---

## 7. Arquivos Relevantes

| Arquivo | Descrição |
|---------|-----------|
| `/home/ubuntu/erp-demo/server/routers/ifoodImport.ts` | Backend - Rotas de importação iFood |
| `/home/ubuntu/erp-demo/client/src/pages/ImportadorIfood.tsx` | Frontend - Página do importador |
| `/home/ubuntu/erp-demo/drizzle/schema.ts` | Schema do banco de dados |

---

**Documento preparado para consulta com Orion.**
