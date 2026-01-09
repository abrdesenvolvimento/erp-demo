import { getCustomerAccountHistory } from './server/db';
import { generateReceivablesPDF } from './server/receivablesPdf';

async function testPDFBase64() {
  console.log('Buscando dados do cliente Victor Hugo...');
  
  const customerId = 360009;
  const customerDetail = await getCustomerAccountHistory(customerId);
  
  if (!customerDetail) {
    console.error('Cliente não encontrado');
    process.exit(1);
  }
  
  // Filtrar apenas vendas/débitos
  const transacoesEmAberto = customerDetail.history.filter(
    item => item.type === 'SALE' || item.type === 'DEBIT'
  );
  
  const filteredData = {
    ...customerDetail,
    history: transacoesEmAberto
  };
  
  console.log('Gerando PDF...');
  
  const pdfStream = await generateReceivablesPDF(filteredData as any);
  
  // Converter stream para buffer (igual ao routers.ts)
  const chunks: Buffer[] = [];
  
  return new Promise<void>((resolve, reject) => {
    pdfStream.on('data', (chunk: Buffer) => {
      console.log('Chunk recebido:', chunk.length, 'bytes');
      chunks.push(chunk);
    });
    pdfStream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      console.log('Buffer total:', buffer.length, 'bytes');
      const base64 = buffer.toString('base64');
      console.log('Base64 length:', base64.length);
      console.log('Base64 primeiros 100 chars:', base64.substring(0, 100));
      resolve();
    });
    pdfStream.on('error', (err) => {
      console.error('Erro no stream:', err);
      reject(err);
    });
  });
}

testPDFBase64().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
