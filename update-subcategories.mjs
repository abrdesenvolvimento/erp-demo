import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Ler CSV
const csvContent = readFileSync('/home/ubuntu/upload/SubcategoriaProdutos.csv', 'utf-8');
const lines = csvContent.split('\n').slice(1); // Pular cabeçalho

// Primeiro, buscar todas as subcategorias existentes
const [subcategories] = await connection.execute('SELECT id, name FROM subcategories');
const subcategoryMap = {};
for (const sc of subcategories) {
  subcategoryMap[sc.name.toLowerCase()] = sc.id;
}

console.log(`📋 Subcategorias encontradas: ${Object.keys(subcategoryMap).length}`);
console.log(subcategoryMap);

let updated = 0;
let notFound = 0;
let errors = 0;

for (const line of lines) {
  if (!line.trim()) continue;
  
  const [productId, productName, subcategoryName] = line.split(';');
  
  if (!productId || !subcategoryName) continue;
  
  const subcategoryId = subcategoryMap[subcategoryName.toLowerCase()];
  
  if (!subcategoryId) {
    console.log(`⚠️  Subcategoria não encontrada: "${subcategoryName}" para produto ${productId}`);
    notFound++;
    continue;
  }
  
  try {
    await connection.execute(
      'UPDATE products SET subcategoryId = ? WHERE id = ?',
      [subcategoryId, parseInt(productId)]
    );
    updated++;
    
    if (updated % 50 === 0) {
      console.log(`✅ ${updated} produtos atualizados...`);
    }
  } catch (error) {
    console.error(`❌ Erro ao atualizar produto ${productId}:`, error.message);
    errors++;
  }
}

await connection.end();

console.log('\n📊 RESUMO:');
console.log(`✅ Atualizados: ${updated}`);
console.log(`⚠️  Subcategorias não encontradas: ${notFound}`);
console.log(`❌ Erros: ${errors}`);

process.exit(0);
