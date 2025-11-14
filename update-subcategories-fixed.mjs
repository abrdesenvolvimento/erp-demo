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
  subcategoryMap[sc.name.toLowerCase().trim()] = sc.id;
}

console.log(`📋 Subcategorias encontradas: ${Object.keys(subcategoryMap).length}`);
console.log(subcategoryMap);

let updated = 0;
let notFound = 0;
let errors = 0;
const notFoundList = [];

for (const line of lines) {
  if (!line.trim()) continue;
  
  const parts = line.split(';');
  if (parts.length < 3) continue;
  
  const productId = parts[0].trim();
  const productName = parts[1].trim();
  const subcategoryName = parts[2].trim().replace(/\r?\n/g, ''); // Remover quebras de linha
  
  if (!productId || !subcategoryName) continue;
  
  const subcategoryId = subcategoryMap[subcategoryName.toLowerCase()];
  
  if (!subcategoryId) {
    const entry = `"${subcategoryName}" (produto ${productId} - ${productName})`;
    if (!notFoundList.includes(subcategoryName)) {
      notFoundList.push(subcategoryName);
      console.log(`⚠️  Subcategoria não encontrada: ${entry}`);
    }
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
console.log(`\n🔍 Subcategorias únicas não encontradas: ${notFoundList.length}`);
console.log(notFoundList);

process.exit(0);
