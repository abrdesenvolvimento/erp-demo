import { getCustomerAccountHistory } from './server/db';
import { generateReceivablesPDF } from './server/receivablesPdf';
import fs from 'fs';

async function testPDF() {
  console.log('Buscando dados do cliente Victor Hugo...');
  
  // ID do cliente Victor Hugo
  const customerId = 360009;
  
  const customerDetail = await getCustomerAccountHistory(customerId);
  
  if (!customerDetail) {
    console.error('Cliente não encontrado');
    process.exit(1);
  }
  
  console.log('Cliente:', customerDetail.customer.name);
  console.log('Saldo:', customerDetail.currentBalance);
  console.log('Total histórico:', customerDetail.history.length);
  
  // Filtrar apenas vendas/débitos
  const transacoesEmAberto = customerDetail.history.filter(
    item => item.type === 'SALE' || item.type === 'DEBIT'
  );
  
  console.log('Transações em aberto:', transacoesEmAberto.length);
  
  const filteredData = {
    ...customerDetail,
    history: transacoesEmAberto
  };
  
  console.log('Gerando PDF...');
  
  const pdfStream = await generateReceivablesPDF(filteredData as any);
  
  // Salvar em arquivo
  const outputPath = '/tmp/test-pdf.pdf';
  const writeStream = fs.createWriteStream(outputPath);
  
  pdfStream.pipe(writeStream);
  
  writeStream.on('finish', () => {
    const stats = fs.statSync(outputPath);
    console.log('PDF gerado:', outputPath);
    console.log('Tamanho:', stats.size, 'bytes');
    process.exit(0);
  });
  
  writeStream.on('error', (err) => {
    console.error('Erro ao salvar PDF:', err);
    process.exit(1);
  });
}

testPDF().catch(console.error);
