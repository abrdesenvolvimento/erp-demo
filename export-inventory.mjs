import mysql from 'mysql2/promise';
import { writeFileSync } from 'fs';

async function exportInventory() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('📦 Exportando inventário...');
  
  const [produtos] = await conn.execute(`
    SELECT 
      p.id,
      p.ean,
      p.name,
      c.name as categoria,
      p.subcategory,
      p.uom,
      p.avgCost,
      p.currentStock,
      p.minStock,
      p.expirationDate,
      p.isComposite,
      p.active,
      p.notes,
      p.createdAt,
      p.updatedAt
    FROM products p
    LEFT JOIN categories c ON p.categoryId = c.id
    ORDER BY p.name
  `);
  
  console.log(`✅ ${produtos.length} produtos encontrados`);
  
  // Cabeçalho
  let csv = 'ID;EAN;Nome;Categoria;Subcategoria;Unidade;Custo Médio;Estoque Atual;Estoque Mínimo;Data Validade;É Composto;Ativo;Observações;Criado Em;Atualizado Em\n';
  
  // Dados
  produtos.forEach(p => {
    const expiryDate = p.expirationDate ? new Date(p.expirationDate).toISOString().split('T')[0] : '';
    const createdAt = p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '';
    const updatedAt = p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : '';
    
    csv += [
      p.id,
      p.ean || '',
      `"${p.name}"`, // Aspas para nomes com vírgula
      p.categoria || '',
      p.subcategory || '',
      p.uom || 'UN',
      p.avgCost || '0',
      p.currentStock || '0',
      p.minStock || '0',
      expiryDate,
      p.isComposite ? 'SIM' : 'NÃO',
      p.active ? 'SIM' : 'NÃO',
      p.notes ? `"${p.notes.replace(/"/g, '""')}"` : '',
      createdAt,
      updatedAt
    ].join(';') + '\n';
  });
  
  // Salvar arquivo
  writeFileSync('/home/ubuntu/inventario-completo.csv', csv, 'utf8');
  console.log('💾 Arquivo salvo: /home/ubuntu/inventario-completo.csv');
  
  // Estatísticas
  const totalEstoque = produtos.reduce((sum, p) => sum + (parseFloat(p.currentStock) || 0), 0);
  const totalValor = produtos.reduce((sum, p) => sum + ((parseFloat(p.currentStock) || 0) * (parseFloat(p.avgCost) || 0)), 0);
  const produtosAbaixoMinimo = produtos.filter(p => (parseFloat(p.currentStock) || 0) < (parseFloat(p.minStock) || 0)).length;
  const produtosAtivos = produtos.filter(p => p.active).length;
  const produtosCompostos = produtos.filter(p => p.isComposite).length;
  
  console.log('\n📊 ESTATÍSTICAS:');
  console.log(`   Total de produtos: ${produtos.length}`);
  console.log(`   Produtos ativos: ${produtosAtivos}`);
  console.log(`   Produtos compostos (packs): ${produtosCompostos}`);
  console.log(`   Quantidade total em estoque: ${totalEstoque.toFixed(2)} unidades`);
  console.log(`   Valor total em estoque: R$ ${totalValor.toFixed(2)}`);
  console.log(`   Produtos abaixo do mínimo: ${produtosAbaixoMinimo}`);
  
  await conn.end();
}

exportInventory().catch(console.error);
