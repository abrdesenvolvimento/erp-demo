/**
 * Utilitário de impressão de tickets para o módulo Salão.
 * Gera uma janela popup formatada para impressoras térmicas (80mm ou 58mm).
 * 
 * O roteamento por departamento funciona assim:
 * - Cada item tem um `productionDestination` (KITCHEN, BAR, BOTH, NONE)
 * - O sistema agrupa itens por destino e imprime um ticket separado para cada departamento
 * - A impressora física é selecionada pelo operador no diálogo de impressão do SO
 *   (configurar a impressora padrão do dispositivo de cada estação)
 */

export type PrintTicketItem = {
  productName: string;
  quantity: number | string;
  notes?: string | null;
};

export type PrintTicketData = {
  destination: "KITCHEN" | "BAR" | "CASHIER";
  tableNumber: number | string;
  waiterName?: string | null;
  orderId: number;
  items: PrintTicketItem[];
  paperWidth?: "80mm" | "58mm";
};

export type PrintReceiptData = {
  tableNumber: number | string;
  orderId: number;
  waiterName?: string | null;
  guestCount?: number;
  openedAt?: string | Date | null;
  items: Array<{
    productName: string;
    quantity: number | string;
    unitPrice: number | string;
    totalPrice: number | string;
    status?: string;
  }>;
  subtotal: number;
  tipPercent?: number;
  tipAmount?: number;
  totalAmount: number;
  payments?: Array<{ method: string; amount: number | string }>;
  paperWidth?: "80mm" | "58mm";
};

const DEST_LABELS: Record<string, string> = {
  KITCHEN: "COZINHA",
  BAR: "BAR",
  CASHIER: "CAIXA",
};

/**
 * Imprime um ticket de produção (Cozinha/Bar)
 */
export function printProductionTicket(data: PrintTicketData): boolean {
  const win = window.open("", "_blank", "width=400,height=500");
  if (!win) {
    return false;
  }

  const width = data.paperWidth || "80mm";
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const destLabel = DEST_LABELS[data.destination] || data.destination;

  const itemsHtml = data.items
    .map(item => `
      <div class="item">
        <span class="qty">${parseFloat(String(item.quantity))}x</span>
        <span class="name">${item.productName}</span>
      </div>
      ${item.notes ? `<div class="notes">OBS: ${item.notes}</div>` : ""}
    `)
    .join("");

  win.document.write(`
    <!DOCTYPE html>
    <html><head><title>Ticket ${destLabel}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { height: auto !important; min-height: 0 !important; }
      body { font-family: 'Courier New', monospace; padding: 8mm 6mm 5mm 6mm; font-size: 14px; max-width: ${width}; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
      .header h2 { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
      .header .mesa { font-size: 28px; font-weight: 900; margin: 4px 0; }
      .header .info { font-size: 11px; color: #555; }
      .item { display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px dotted #ccc; align-items: baseline; }
      .item .qty { font-weight: 900; font-size: 18px; min-width: 35px; }
      .item .name { font-size: 15px; font-weight: 700; flex: 1; }
      .notes { font-size: 12px; font-weight: 700; color: #c00; padding: 2px 0 6px 43px; text-transform: uppercase; }
      .footer { text-align: center; margin-top: 12px; font-size: 10px; border-top: 2px dashed #000; padding-top: 8px; color: #888; }
      @page { size: ${width} auto; margin: 0; }
      @media print { html, body { height: auto !important; width: ${width}; } body { padding: 2mm 4mm; } }
    </style></head><body>
    <div class="header">
      <h2>${destLabel}</h2>
      <div class="mesa">MESA ${data.tableNumber}</div>
      <div class="info">${now} | Garçom: ${data.waiterName || "—"}</div>
    </div>
    <div class="items">${itemsHtml}</div>
    <div class="footer">Comanda #${data.orderId}</div>
    <script>window.onload = function() { window.print(); window.close(); }<\/script>
    </body></html>
  `);
  win.document.close();
  return true;
}

/**
 * Imprime um cupom de conta (Caixa)
 */
export function printReceipt(data: PrintReceiptData): boolean {
  const win = window.open("", "_blank", "width=400,height=700");
  if (!win) {
    return false;
  }

  const width = data.paperWidth || "80mm";
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const activeItems = data.items.filter(i => i.status !== "CANCELLED");
  const itemsHtml = activeItems
    .map(item => `
      <tr>
        <td style="padding:2px 0">${parseFloat(String(item.quantity))}x ${item.productName}</td>
        <td style="padding:2px 0;text-align:right;white-space:nowrap">R$ ${parseFloat(String(item.totalPrice)).toFixed(2)}</td>
      </tr>
    `)
    .join("");

  const paymentsHtml = data.payments
    ? data.payments.map(p => `
      <div class="payment-row">
        <span>${p.method}</span>
        <span>R$ ${parseFloat(String(p.amount)).toFixed(2)}</span>
      </div>
    `).join("")
    : "";

  win.document.write(`
    <!DOCTYPE html>
    <html><head><title>Conta Mesa ${data.tableNumber}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Courier New', monospace; padding: 6mm; font-size: 12px; max-width: ${width}; margin: 0 auto; }
      .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 8px; }
      .header h2 { font-size: 14px; font-weight: 900; }
      .header .mesa { font-size: 20px; font-weight: 900; margin: 4px 0; }
      .header .info { font-size: 10px; color: #555; }
      table { width: 100%; border-collapse: collapse; margin: 6px 0; }
      .totals { border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; }
      .total-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px; }
      .total-row.grand { font-size: 16px; font-weight: 900; border-top: 2px solid #000; padding-top: 6px; margin-top: 4px; }
      .payment-row { display: flex; justify-content: space-between; padding: 1px 0; font-size: 11px; color: #555; }
      .footer { text-align: center; margin-top: 10px; font-size: 9px; border-top: 1px dashed #000; padding-top: 6px; color: #888; }
      @page { size: ${width} auto; margin: 0; }
      @media print { html, body { height: auto !important; width: ${width}; } body { padding: 2mm 4mm; } }
    </style></head><body>
    <div class="header">
      <h2>A BRASA REÚNE</h2>
      <div class="mesa">MESA ${data.tableNumber}</div>
      <div class="info">${now} | ${data.guestCount ?? 1} pessoa(s) | Garçom: ${data.waiterName || "—"}</div>
    </div>
    <table>${itemsHtml}</table>
    <div class="totals">
      <div class="total-row"><span>Subtotal</span><span>R$ ${data.subtotal.toFixed(2)}</span></div>
      ${data.tipAmount && data.tipAmount > 0 ? `<div class="total-row"><span>Taxa serviço (${data.tipPercent ?? 10}%)</span><span>R$ ${data.tipAmount.toFixed(2)}</span></div>` : ""}
      <div class="total-row grand"><span>TOTAL</span><span>R$ ${data.totalAmount.toFixed(2)}</span></div>
    </div>
    ${paymentsHtml ? `<div style="margin-top:6px;border-top:1px dashed #ccc;padding-top:4px"><div style="font-size:10px;font-weight:bold;margin-bottom:2px">Pagamento:</div>${paymentsHtml}</div>` : ""}
    <div class="footer">Comanda #${data.orderId} | Obrigado pela visita!</div>
    <script>window.onload = function() { window.print(); window.close(); }<\/script>
    </body></html>
  `);
  win.document.close();
  return true;
}

/**
 * Imprime tickets de produção agrupados por destino.
 * Chamado automaticamente quando itens são adicionados à comanda.
 */
export function printProductionTicketsByDestination(
  items: Array<PrintTicketItem & { productionDestination: string }>,
  meta: { tableNumber: number | string; waiterName?: string | null; orderId: number; paperWidth?: "80mm" | "58mm" }
): { printed: string[]; failed: string[] } {
  const result = { printed: [] as string[], failed: [] as string[] };

  // Group items by destination
  const byDest: Record<string, PrintTicketItem[]> = {};
  for (const item of items) {
    const dest = item.productionDestination;
    if (dest === "NONE") continue; // Items with no destination don't get printed
    
    if (dest === "BOTH") {
      // Items for BOTH go to both KITCHEN and BAR
      if (!byDest["KITCHEN"]) byDest["KITCHEN"] = [];
      if (!byDest["BAR"]) byDest["BAR"] = [];
      byDest["KITCHEN"].push(item);
      byDest["BAR"].push(item);
    } else {
      if (!byDest[dest]) byDest[dest] = [];
      byDest[dest].push(item);
    }
  }

  // Print one ticket per destination
  for (const [dest, destItems] of Object.entries(byDest)) {
    const success = printProductionTicket({
      destination: dest as "KITCHEN" | "BAR",
      tableNumber: meta.tableNumber,
      waiterName: meta.waiterName,
      orderId: meta.orderId,
      items: destItems,
      paperWidth: meta.paperWidth,
    });
    if (success) {
      result.printed.push(dest);
    } else {
      result.failed.push(dest);
    }
  }

  return result;
}
