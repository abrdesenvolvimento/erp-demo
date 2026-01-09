import { generateReceivablesPDF } from './server/receivablesPdf';
import fs from 'fs';

const testData = {
  customer: {
    id: 1,
    name: 'Victor Hugo Fernandes da Silva',
    creditLimit: '400.00',
  },
  currentBalance: '165.50',
  history: [
    {
      id: 1,
      date: new Date('2025-12-30'),
      amount: '165.00',
      type: 'SALE' as const,
      description: 'Venda #35550002',
      balance: '165.00',
      items: [
        { productName: 'Ballantine\'s Finest 1l', quantity: 1, unitPrice: '90.00', totalPrice: '90.00' },
        { productName: 'Red Bull 250ml', quantity: 5, unitPrice: '10.00', totalPrice: '50.00' },
        { productName: 'Coko Coco 200ml', quantity: 5, unitPrice: '4.00', totalPrice: '20.00' },
        { productName: 'Copo Ultra 700ml', quantity: 5, unitPrice: '1.00', totalPrice: '5.00' },
      ],
    },
    {
      id: 2,
      date: new Date('2026-01-05'),
      amount: '9.00',
      type: 'SALE' as const,
      description: 'Venda #37680001',
      balance: '174.50',
      items: [
        { productName: 'Smirnoff Ice Limão 275ml', quantity: 1, unitPrice: '9.00', totalPrice: '9.00' },
      ],
    },
    {
      id: 3,
      date: new Date('2026-01-05'),
      amount: '9.00',
      type: 'SALE' as const,
      description: 'Venda #37680002',
      balance: '183.50',
      items: [
        { productName: 'Rothmans Blue Hand-Selected', quantity: 1, unitPrice: '9.00', totalPrice: '9.00' },
      ],
    },
  ],
};

async function main() {
  console.log('Gerando PDF de teste...');
  const pdfStream = await generateReceivablesPDF(testData);
  
  const chunks: Buffer[] = [];
  pdfStream.on('data', (chunk: Buffer) => chunks.push(chunk));
  pdfStream.on('end', () => {
    const buffer = Buffer.concat(chunks);
    fs.writeFileSync('/tmp/test-victor.pdf', buffer);
    console.log('PDF gerado:', buffer.length, 'bytes');
    console.log('Salvo em /tmp/test-victor.pdf');
  });
  pdfStream.on('error', (err: Error) => {
    console.error('Erro:', err);
  });
}

main();
