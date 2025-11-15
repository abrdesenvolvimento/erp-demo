import { drizzle } from 'drizzle-orm/mysql2';
import { products, categories, subcategories } from './drizzle/schema.ts';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';

const db = drizzle(process.env.DATABASE_URL);

// Estatísticas gerais
const totalProdutos = await db.select({ count: sql`COUNT(*)` }).from(products);
const totalEstoque = await db.select({ total: sql`SUM(currentStock)` }).from(products);

// Estatísticas por categoria
const porCategoria = await db
  .select({
    categoria: categories.name,
    total_produtos: sql`COUNT(${products.id})`,
    estoque_total: sql`SUM(${products.currentStock})`,
  })
  .from(products)
  .leftJoin(categories, eq(products.categoryId, categories.id))
  .groupBy(categories.id, categories.name)
  .orderBy(sql`COUNT(${products.id}) DESC`);

// Estatísticas por subcategoria (top 10)
const porSubcategoria = await db
  .select({
    subcategoria: subcategories.name,
    categoria: categories.name,
    total_produtos: sql`COUNT(${products.id})`,
    estoque_total: sql`SUM(${products.currentStock})`,
  })
  .from(products)
  .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
  .leftJoin(categories, eq(products.categoryId, categories.id))
  .groupBy(subcategories.id, subcategories.name, categories.name)
  .orderBy(sql`COUNT(${products.id}) DESC`)
  .limit(10);

// Produtos com estoque zerado
const estoqueZerado = await db
  .select({ count: sql`COUNT(*)` })
  .from(products)
  .where(sql`${products.currentStock} = 0`);

// Gerar relatório em Markdown
const relatorio = `# Relatório de Inventário - ${new Date().toLocaleDateString('pt-BR')}

## 📊 Resumo Geral

- **Total de Produtos Cadastrados:** ${totalProdutos[0].count}
- **Estoque Total (unidades):** ${totalEstoque[0].total || 0}
- **Produtos com Estoque Zerado:** ${estoqueZerado[0].count}

---

## 📦 Produtos por Categoria

| Categoria | Total de Produtos | Estoque Total |
|-----------|-------------------|---------------|
${porCategoria.map(c => `| ${c.categoria || 'Sem Categoria'} | ${c.total_produtos} | ${c.estoque_total || 0} |`).join('\n')}

---

## 🏷️ Top 10 Subcategorias

| Subcategoria | Categoria | Total de Produtos | Estoque Total |
|--------------|-----------|-------------------|---------------|
${porSubcategoria.map(s => `| ${s.subcategoria || 'Sem Subcategoria'} | ${s.categoria || 'N/A'} | ${s.total_produtos} | ${s.estoque_total || 0} |`).join('\n')}

---

## 📋 Arquivos Gerados

- **CSV para Inventário:** \`produtos_atualizados.csv\`
- **Total de Registros:** ${totalProdutos[0].count} produtos
- **Data de Geração:** ${new Date().toLocaleString('pt-BR')}

---

## 📈 Crescimento

- **Última Exportação:** 361 produtos
- **Exportação Atual:** ${totalProdutos[0].count} produtos
- **Novos Produtos:** ${Number(totalProdutos[0].count) - 361} produtos (+${((Number(totalProdutos[0].count) - 361) / 361 * 100).toFixed(1)}%)
`;

fs.writeFileSync('/home/ubuntu/relatorio-inventario.md', relatorio);
console.log('✅ Relatório gerado: /home/ubuntu/relatorio-inventario.md');
