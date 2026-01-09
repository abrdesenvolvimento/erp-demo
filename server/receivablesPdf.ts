import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Dados da Empresa
const COMPANY_INFO = {
  name: 'Adega Beira Rio',
  razaoSocial: 'Adega Beira Rio Comércio de Bebidas Ltda',
  cnpj: '50.887.052/0001-08',
  endereco: 'Rua Israel, 286, Rochdale',
  cidade: 'Osasco/SP',
  cep: '06220-053',
};

// Interface para dados do histórico de conta corrente
export interface CustomerAccountData {
  customer: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    creditLimit?: string | number | null;
  };
  currentBalance: string;
  history: Array<{
    id: number;
    date: Date | string;
    amount: string;
    type: 'SALE' | 'PAYMENT' | 'DEBIT';
    description: string;
    paymentMethod?: string | null;
    balance: string;
    items?: Array<{
      productName: string;
      quantity: number;
      unitPrice: string;
      totalPrice: string;
    }>;
  }>;
}

/**
 * Formata data/hora no timezone de Brasília
 */
function formatDateTimeBrasilia(): string {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function formatDateBrasilia(): string {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Gera um PDF com o extrato de Contas a Receber para um cliente
 * Os dados já vêm filtrados do backend (apenas transações em aberto)
 */
export async function generateReceivablesPDF(data: CustomerAccountData): Promise<any> {
  // Tentar carregar logo local da Adega
  let logoBuffer: Buffer | null = null;
  
  // Usar logo otimizado para PDF (menor e com transparência)
  const localLogoPath = path.join(process.cwd(), 'client', 'public', 'logo-adega-pdf.png');
  try {
    if (fs.existsSync(localLogoPath)) {
      logoBuffer = fs.readFileSync(localLogoPath);
    }
  } catch (error) {
    console.error('Erro ao carregar logo local:', error);
  }

  // Cores da Empresa (Verde e Dourado)
  const primaryColor = '#2D5A3D';
  const accentColor = '#D4A574';
  const textColor = '#333333';
  const lightGray = '#F5F5F5';
  const borderColor = '#CCCCCC';
  const greenColor = '#27AE60';
  const redColor = '#C0392B';

  // Função auxiliar para formatar moeda
  const formatCurrency = (value: number | string): string => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numValue || 0);
  };

  // Função auxiliar para formatar data
  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  };

  // Funcao auxiliar para formatar data com hora (sem segundos)
  const formatDateWithTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const datePart = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const timePart = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false, hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
  };

  // Obter saldo devedor atual
  const saldoDevedor = parseFloat(data.currentBalance || '0');
  
  // Os dados já vêm filtrados do backend
  const history = data.history || [];
  
  // Separar vendas/débitos e pagamentos
  const vendasEmAberto = history.filter(t => t.type === 'SALE' || t.type === 'DEBIT');
  const pagamentosRecentes = history.filter(t => t.type === 'PAYMENT');

  const doc = new PDFDocument({
    margin: 40,
    size: 'A4',
    autoFirstPage: true,
  });

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;
  const bottomMargin = 60; // Margem inferior para evitar corte

  // Função para verificar se precisa de nova página
  const checkNewPage = (requiredHeight: number): boolean => {
    if (doc.y + requiredHeight > pageHeight - bottomMargin) {
      doc.addPage();
      doc.y = margin;
      return true;
    }
    return false;
  };

  // ===== CABEÇALHO COM DADOS DA EMPRESA =====
  doc.rect(0, 0, pageWidth, 130).fill(primaryColor);
  
  // Logo à esquerda - tamanho ajustado (logo original 355x200)
  if (logoBuffer) {
    try {
      // O logo tem proporção 355:200, vamos usar altura de 90px
      doc.image(logoBuffer, margin, 20, { 
        height: 90,
      });
    } catch (error) {
      console.error('Erro ao adicionar logo ao PDF:', error);
    }
  }
  
  // Título e dados da empresa à direita do logo
  // Logo tem 355:200, altura 90px = largura ~160px
  const textStartX = logoBuffer ? margin + 170 : margin;
  const textWidth = logoBuffer ? contentWidth - 170 : contentWidth;
  
  doc.fontSize(20).font('Helvetica-Bold').fillColor('white');
  doc.text('EXTRATO DE CONTAS A RECEBER', textStartX, 25, { width: textWidth });

  doc.fontSize(10).font('Helvetica').fillColor('white');
  doc.text(COMPANY_INFO.razaoSocial, textStartX, 55, { width: textWidth });
  doc.text(`CNPJ: ${COMPANY_INFO.cnpj}`, textStartX, 70, { width: textWidth });
  doc.text(`${COMPANY_INFO.endereco} - ${COMPANY_INFO.cidade}`, textStartX, 85, { width: textWidth });
  doc.text(`CEP: ${COMPANY_INFO.cep}`, textStartX, 100, { width: textWidth });

  doc.y = 145;

  // ===== INFORMAÇÕES DO CLIENTE =====
  doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor);
  doc.text('DADOS DO CLIENTE', margin, doc.y);

  doc.fontSize(10).font('Helvetica').fillColor(textColor);
  doc.text(`Nome: ${data.customer.name}`, margin, doc.y + 5);
  
  const creditLimit = data.customer.creditLimit 
    ? formatCurrency(data.customer.creditLimit)
    : 'Não definido';
  doc.text(`Limite de Crédito: ${creditLimit}`);

  doc.moveDown(0.5);

  // ===== RESUMO FINANCEIRO =====
  const summaryBoxY = doc.y + 5;
  const boxHeight = 60;
  const boxWidth = (contentWidth - 20) / 2;

  // Box 1: Saldo Devedor
  doc.rect(margin, summaryBoxY, boxWidth, boxHeight).fill(lightGray);
  doc.rect(margin, summaryBoxY, boxWidth, 4).fill(redColor);
  doc.fontSize(9).font('Helvetica').fillColor(textColor);
  doc.text('SALDO DEVEDOR ATUAL', margin + 10, summaryBoxY + 15);
  doc.fontSize(18).font('Helvetica-Bold').fillColor(redColor);
  doc.text(formatCurrency(saldoDevedor), margin + 10, summaryBoxY + 32, { width: boxWidth - 20 });

  // Box 2: Data do Extrato
  doc.rect(margin + boxWidth + 20, summaryBoxY, boxWidth, boxHeight).fill(lightGray);
  doc.rect(margin + boxWidth + 20, summaryBoxY, boxWidth, 4).fill(accentColor);
  doc.fontSize(9).font('Helvetica').fillColor(textColor);
  doc.text('DATA DO EXTRATO', margin + boxWidth + 30, summaryBoxY + 15);
  doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryColor);
  doc.text(formatDateBrasilia(), margin + boxWidth + 30, summaryBoxY + 35);

  doc.y = summaryBoxY + boxHeight + 20;

  // ===== TABELA DE VENDAS EM ABERTO =====
  doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor);
  doc.text('VENDAS/DÉBITOS EM ABERTO', margin, doc.y);

  const tableTop = doc.y + 10;
  const tableMargin = margin;
  const col1Width = 85;  // Data + Hora
  const col2Width = 60;  // Numero da Venda
  const col3Width = 150; // Descricao / Produto
  const col4Width = 40;  // Qtd
  const col5Width = 65;  // Valor Unit.
  const col6Width = 60;  // Total

  // Cabeçalho da tabela
  doc.rect(tableMargin, tableTop, contentWidth, 22).fill(primaryColor);
  doc.fontSize(8).font('Helvetica-Bold').fillColor('white');

  let colX = tableMargin + 5;
  doc.text('Data / Hora', colX, tableTop + 6, { width: col1Width - 10 });
  colX += col1Width;
  doc.text('No Venda', colX, tableTop + 6, { width: col2Width - 10, align: 'center' });
  colX += col2Width;
  doc.text('Descricao / Produto', colX, tableTop + 6, { width: col3Width - 10 });
  colX += col3Width;
  doc.text('Qtd', colX, tableTop + 6, { width: col4Width - 10, align: 'center' });
  colX += col4Width;
  doc.text('Valor Unit.', colX, tableTop + 6, { width: col5Width - 10, align: 'right' });
  colX += col5Width;
  doc.text('Total', colX, tableTop + 6, { width: col6Width - 10, align: 'right' });

  doc.y = tableTop + 22;
  doc.fontSize(7).font('Helvetica').fillColor(textColor);

  if (vendasEmAberto.length > 0) {
    let rowIndex = 0;
    
    for (const item of vendasEmAberto) {
      const items = item.items || [];
      
      if (items.length === 0) {
        // Verificar se precisa de nova página
        checkNewPage(20);
        
        const currentY = doc.y;
        
        if (rowIndex % 2 === 0) {
          doc.rect(tableMargin, currentY, contentWidth, 20).fill(lightGray);
        }
        
        colX = tableMargin + 5;
        doc.fillColor(textColor);
        doc.text(formatDateWithTime(item.date), colX, currentY + 5, { width: col1Width - 10 });
        colX += col1Width;
        doc.text(item.id?.toString() || '-', colX, currentY + 5, { width: col2Width - 10, align: 'center' });
        colX += col2Width;
        doc.text(item.description || (item.type === 'DEBIT' ? 'Débito Manual' : 'Venda a prazo'), colX, currentY + 5, { width: col3Width - 10 });
        colX += col3Width;
        doc.text('-', colX, currentY + 5, { width: col4Width - 10, align: 'center' });
        colX += col4Width;
        doc.text('-', colX, currentY + 5, { width: col5Width - 10, align: 'right' });
        colX += col5Width;
        doc.font('Helvetica-Bold').fillColor(redColor);
        doc.text(formatCurrency(item.amount), colX, currentY + 5, { width: col6Width - 10, align: 'right' });
        doc.font('Helvetica').fillColor(textColor);
        
        doc.y = currentY + 20;
        doc.moveTo(tableMargin, doc.y).lineTo(tableMargin + contentWidth, doc.y).stroke(borderColor);
        rowIndex++;
      } else {
        for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
          const produto = items[itemIdx];
          
          // Verificar se precisa de nova página
          checkNewPage(18);
          
          const currentY = doc.y;
          
          if (rowIndex % 2 === 0) {
            doc.rect(tableMargin, currentY, contentWidth, 18).fill(lightGray);
          }

          colX = tableMargin + 5;
          doc.fillColor(textColor);

          if (itemIdx === 0) {
            doc.text(formatDateWithTime(item.date), colX, currentY + 4, { width: col1Width - 10 });
          }
          colX += col1Width;

          if (itemIdx === 0) {
            doc.text(item.id?.toString() || '-', colX, currentY + 4, { width: col2Width - 10, align: 'center' });
          }
          colX += col2Width;

          doc.text(produto.productName || 'Produto', colX, currentY + 4, { width: col3Width - 10 });
          colX += col3Width;

          doc.text(produto.quantity?.toString() || '1', colX, currentY + 4, { width: col4Width - 10, align: 'center' });
          colX += col4Width;

          doc.text(formatCurrency(produto.unitPrice || 0), colX, currentY + 4, { width: col5Width - 10, align: 'right' });
          colX += col5Width;

          if (itemIdx === items.length - 1) {
            doc.font('Helvetica-Bold').fillColor(redColor);
            doc.text(formatCurrency(item.amount), colX, currentY + 4, { width: col6Width - 10, align: 'right' });
            doc.font('Helvetica').fillColor(textColor);
          }

          doc.y = currentY + 18;
          rowIndex++;
        }
        
        doc.moveTo(tableMargin, doc.y).lineTo(tableMargin + contentWidth, doc.y).stroke(borderColor);
      }
    }
  } else {
    doc.rect(tableMargin, doc.y, contentWidth, 30).fill(lightGray);
    doc.fontSize(10).fillColor(greenColor);
    doc.text('Nenhuma venda em aberto - Cliente sem débitos pendentes', tableMargin, doc.y + 10, { width: contentWidth, align: 'center' });
    doc.y += 30;
  }

  doc.y += 15;

  // ===== HISTÓRICO DE PAGAMENTOS RECENTES =====
  if (pagamentosRecentes.length > 0) {
    // Verificar se precisa de nova página para a seção de pagamentos
    checkNewPage(60);
    
    doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor);
    doc.text('PAGAMENTOS RECENTES', margin, doc.y);

    const paymentTableTop = doc.y + 10;
    const payCol1Width = 150;
    const payCol2Width = 200;
    const payCol3Width = 165;

    doc.rect(tableMargin, paymentTableTop, contentWidth, 22).fill(greenColor);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('white');

    colX = tableMargin + 5;
    doc.text('Data Recebimento', colX, paymentTableTop + 6, { width: payCol1Width - 10 });
    colX += payCol1Width;
    doc.text('Forma de Pagamento', colX, paymentTableTop + 6, { width: payCol2Width - 10 });
    colX += payCol2Width;
    doc.text('Valor Recebido', colX, paymentTableTop + 6, { width: payCol3Width - 10, align: 'right' });

    doc.y = paymentTableTop + 22;
    doc.fontSize(7).font('Helvetica').fillColor(textColor);

    for (let idx = 0; idx < pagamentosRecentes.length; idx++) {
      const payment = pagamentosRecentes[idx];
      
      // Verificar se precisa de nova página
      checkNewPage(18);
      
      const currentY = doc.y;
      
      if (idx % 2 === 0) {
        doc.rect(tableMargin, currentY, contentWidth, 18).fill(lightGray);
      }

      colX = tableMargin + 5;
      doc.fillColor(textColor);
      doc.text(formatDateWithTime(payment.date), colX, currentY + 4, { width: payCol1Width - 10 });
      colX += payCol1Width;
      doc.text(payment.paymentMethod || 'Não informado', colX, currentY + 4, { width: payCol2Width - 10 });
      colX += payCol2Width;
      doc.font('Helvetica-Bold').fillColor(greenColor);
      doc.text(formatCurrency(payment.amount), colX, currentY + 4, { width: payCol3Width - 10, align: 'right' });
      doc.font('Helvetica').fillColor(textColor);

      doc.y = currentY + 18;
    }

    doc.moveTo(tableMargin, doc.y).lineTo(tableMargin + contentWidth, doc.y).stroke(borderColor);
  }

  // ===== RODAPÉ SIMPLIFICADO =====
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#666666');
  doc.text(
    `Este documento é uma cópia do extrato de Contas a Receber. Gerado em ${formatDateTimeBrasilia()}.`,
    margin, doc.y,
    { width: contentWidth, align: 'center' }
  );

  doc.end();

  return doc as any;
}
