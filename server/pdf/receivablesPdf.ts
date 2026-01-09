import PDFDocument from 'pdfkit';
import type { Readable } from 'stream';

export interface ReceivableCustomerData {
  customer: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    creditLimit?: number | null;
  };
  totalPending: number;
  sales: Array<{
    id: number;
    saleDate: Date | string;
    totalAmount: number;
    items: Array<{
      productName: string;
      quantity: number;
      unitPrice: number;
    }>;
  }>;
  payments?: Array<{
    paidDate: Date | string;
    paymentMethod: string;
    paidAmount: number;
  }>;
}

/**
 * Gera um PDF com o extrato de Contas a Receber para um cliente
 */
export function generateReceivablesPDF(data: ReceivableCustomerData): any {
  const doc = new PDFDocument({
    margin: 40,
    size: 'A4',
    bufferPages: true,
  });

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;

  // Cores
  const primaryColor = '#1F3A5F'; // Azul escuro
  const accentColor = '#D4A574'; // Dourado
  const textColor = '#333333';
  const lightGray = '#F5F5F5';
  const borderColor = '#CCCCCC';

  // Função auxiliar para formatar moeda
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Função auxiliar para formatar data
  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('pt-BR');
  };

  // ===== CABEÇALHO =====
  doc.fontSize(20).font('Helvetica-Bold').fillColor(primaryColor);
  doc.text('EXTRATO DE CONTAS A RECEBER', { align: 'center' });

  doc.fontSize(10).font('Helvetica').fillColor(textColor);
  doc.text('Adega Beira Rio', { align: 'center' });
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, { align: 'center' });

  doc.moveTo(margin, doc.y + 5).lineTo(pageWidth - margin, doc.y + 5).stroke(borderColor);
  doc.moveDown(0.5);

  // ===== INFORMAÇÕES DO CLIENTE =====
  doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor);
  doc.text('DADOS DO CLIENTE');

  doc.fontSize(10).font('Helvetica').fillColor(textColor);
  doc.text(`Nome: ${data.customer.name}`);
  if (data.customer.email) {
    doc.text(`Email: ${data.customer.email}`);
  }
  if (data.customer.phone) {
    doc.text(`Telefone: ${data.customer.phone}`);
  }
  if (data.customer.creditLimit) {
    doc.text(`Limite de Crédito: ${formatCurrency(data.customer.creditLimit)}`);
  }

  doc.moveDown(0.5);

  // ===== RESUMO FINANCEIRO =====
  const summaryBoxY = doc.y;
  const boxHeight = 60;
  const boxWidth = (contentWidth - 20) / 2;

  // Box 1: Saldo Devedor
  doc.rect(margin, summaryBoxY, boxWidth, boxHeight).fill(lightGray);
  doc.fontSize(9).font('Helvetica').fillColor(textColor);
  doc.text('SALDO DEVEDOR', margin + 10, summaryBoxY + 10);
  doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryColor);
  doc.text(formatCurrency(data.totalPending), margin + 10, summaryBoxY + 25, { width: boxWidth - 20 });

  // Box 2: Data do Extrato
  doc.rect(margin + boxWidth + 20, summaryBoxY, boxWidth, boxHeight).fill(lightGray);
  doc.fontSize(9).font('Helvetica').fillColor(textColor);
  doc.text('DATA DO EXTRATO', margin + boxWidth + 30, summaryBoxY + 10);
  doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor);
  doc.text(new Date().toLocaleDateString('pt-BR'), margin + boxWidth + 30, summaryBoxY + 30);

  doc.moveDown(4);

  // ===== TABELA DE VENDAS =====
  doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor);
  doc.text('VENDAS A PRAZO');

  const tableTop = doc.y + 10;
  const tableMargin = margin;
  const col1Width = 60; // ID Venda
  const col2Width = 70; // Data
  const col3Width = 150; // Produto
  const col4Width = 60; // Qtd
  const col5Width = 70; // Valor Unit
  const col6Width = 80; // Total

  // Cabeçalho da tabela
  doc.rect(tableMargin, tableTop, contentWidth, 20).fill(primaryColor);
  doc.fontSize(9).font('Helvetica-Bold').fillColor('white');

  let colX = tableMargin + 5;
  doc.text('ID Venda', colX, tableTop + 5, { width: col1Width - 10 });
  colX += col1Width;
  doc.text('Data', colX, tableTop + 5, { width: col2Width - 10 });
  colX += col2Width;
  doc.text('Produto', colX, tableTop + 5, { width: col3Width - 10 });
  colX += col3Width;
  doc.text('Qtd', colX, tableTop + 5, { width: col4Width - 10, align: 'right' });
  colX += col4Width;
  doc.text('Valor Unit.', colX, tableTop + 5, { width: col5Width - 10, align: 'right' });
  colX += col5Width;
  doc.text('Total', colX, tableTop + 5, { width: col6Width - 10, align: 'right' });

  // Linhas da tabela
  let currentY = tableTop + 20;
  doc.fontSize(8).font('Helvetica').fillColor(textColor);

  data.sales.forEach((sale) => {
    const itemCount = sale.items.length;
    const rowHeight = 15 * itemCount;

    // Linha de fundo alternada
    if (Math.floor(currentY / 15) % 2 === 0) {
      doc.rect(tableMargin, currentY, contentWidth, rowHeight).fill(lightGray);
    }

    // Renderizar itens da venda
    sale.items.forEach((item, itemIdx) => {
      colX = tableMargin + 5;

      // ID Venda (apenas na primeira linha)
      if (itemIdx === 0) {
        doc.text(`#${sale.id}`, colX, currentY + 3, { width: col1Width - 10 });
      }
      colX += col1Width;

      // Data (apenas na primeira linha)
      if (itemIdx === 0) {
        doc.text(formatDate(sale.saleDate), colX, currentY + 3, { width: col2Width - 10 });
      }
      colX += col2Width;

      // Produto
      doc.text(item.productName, colX, currentY + 3, { width: col3Width - 10 });
      colX += col3Width;

      // Quantidade
      doc.text(item.quantity.toString(), colX, currentY + 3, { width: col4Width - 10, align: 'right' });
      colX += col4Width;

      // Valor Unitário
      doc.text(formatCurrency(item.unitPrice), colX, currentY + 3, { width: col5Width - 10, align: 'right' });
      colX += col5Width;

      // Total (apenas na primeira linha)
      if (itemIdx === 0) {
        doc.font('Helvetica-Bold');
        doc.text(formatCurrency(sale.totalAmount), colX, currentY + 3, { width: col6Width - 10, align: 'right' });
        doc.font('Helvetica');
      }

      currentY += 15;
    });

    // Linha divisória
    doc.moveTo(tableMargin, currentY).lineTo(tableMargin + contentWidth, currentY).stroke(borderColor);
  });

  doc.moveDown(2);

  // ===== HISTÓRICO DE RECEBIMENTOS =====
  if (data.payments && data.payments.length > 0) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor);
    doc.text('HISTÓRICO DE RECEBIMENTOS');

    const paymentTableTop = doc.y + 10;
    const payCol1Width = 100; // Data
    const payCol2Width = 150; // Forma de Pagamento
    const payCol3Width = 100; // Valor

    // Cabeçalho
    doc.rect(tableMargin, paymentTableTop, contentWidth, 20).fill(primaryColor);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('white');

    colX = tableMargin + 5;
    doc.text('Data Recebimento', colX, paymentTableTop + 5, { width: payCol1Width - 10 });
    colX += payCol1Width;
    doc.text('Forma de Pagamento', colX, paymentTableTop + 5, { width: payCol2Width - 10 });
    colX += payCol2Width;
    doc.text('Valor Recebido', colX, paymentTableTop + 5, { width: payCol3Width - 10, align: 'right' });

    // Linhas
    let paymentY = paymentTableTop + 20;
    doc.fontSize(8).font('Helvetica').fillColor(textColor);

    data.payments.forEach((payment, idx) => {
      if (Math.floor(paymentY / 15) % 2 === 0) {
        doc.rect(tableMargin, paymentY, contentWidth, 15).fill(lightGray);
      }

      colX = tableMargin + 5;
      doc.text(formatDate(payment.paidDate), colX, paymentY + 3, { width: payCol1Width - 10 });
      colX += payCol1Width;
      doc.text(payment.paymentMethod, colX, paymentY + 3, { width: payCol2Width - 10 });
      colX += payCol2Width;
      doc.font('Helvetica-Bold').fillColor('#27AE60');
      doc.text(formatCurrency(payment.paidAmount), colX, paymentY + 3, { width: payCol3Width - 10, align: 'right' });
      doc.font('Helvetica').fillColor(textColor);

      paymentY += 15;
    });

    doc.moveTo(tableMargin, paymentY).lineTo(tableMargin + contentWidth, paymentY).stroke(borderColor);
  }

  // ===== RODAPÉ =====
  doc.fontSize(8).fillColor('#999999');
  doc.text('Este documento é uma cópia do extrato de Contas a Receber. Para dúvidas, entre em contato com a Adega Beira Rio.', margin, pageHeight - 40, {
    width: contentWidth,
    align: 'center',
  });

  doc.end();

  return doc as any;
}
