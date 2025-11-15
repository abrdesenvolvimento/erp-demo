import XLSX from 'xlsx';
import { drizzle } from 'drizzle-orm/mysql2';
import { products, subcategories } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

// Ler arquivo Excel
const workbook = XLSX.readFile('/home/ubuntu/upload/CorreçãodeSubcategoria.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log(`📊 Lendo ${data.length} registros do Excel...`);

// Buscar todas as subcategorias para criar mapa nome -> ID
const allSubcategories = await db.select().from(subcategories);
const subcategoryMap = new Map();
allSubcategories.forEach(sub => {
  subcategoryMap.set(sub.name.toLowerCase().trim(), sub.id);
});

console.log(`📋 ${subcategoryMap.size} subcategorias encontradas no banco`);

let updated = 0;
let notFound = [];
let errors = [];

for (const row of data) {
  const productId = row['ID'] || row['id'] || row['Id'];
  const subcategoryName = row['Subcategoria Correção'] || row['Subcategoria'] || row['subcategoria'];
  
  if (!productId || !subcategoryName) {
    console.log(`⚠️  Linha ignorada (dados faltando):`, row);
    continue;
  }
  
  const subcategoryId = subcategoryMap.get(subcategoryName.toLowerCase().trim());
  
  if (!subcategoryId) {
    notFound.push({ productId, subcategoryName });
    continue;
  }
  
  try {
    await db.update(products)
      .set({ subcategoryId })
      .where(eq(products.id, productId));
    updated++;
    
    if (updated % 50 === 0) {
      console.log(`✅ ${updated} produtos atualizados...`);
    }
  } catch (error) {
    errors.push({ productId, error: error.message });
  }
}

console.log('\n📊 RESUMO DA ATUALIZAÇÃO:');
console.log(`✅ Produtos atualizados: ${updated}`);
console.log(`⚠️  Subcategorias não encontradas: ${notFound.length}`);
console.log(`❌ Erros: ${errors.length}`);

if (notFound.length > 0) {
  console.log('\n⚠️  Subcategorias não encontradas no banco:');
  const unique = [...new Set(notFound.map(n => n.subcategoryName))];
  unique.forEach(name => {
    const count = notFound.filter(n => n.subcategoryName === name).length;
    console.log(`   - "${name}" (${count} produtos)`);
  });
}

if (errors.length > 0) {
  console.log('\n❌ Erros durante atualização:');
  errors.forEach(({ productId, error }) => {
    console.log(`   - Produto ${productId}: ${error}`);
  });
}
