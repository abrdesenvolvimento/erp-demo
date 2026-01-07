import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function compare() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('=' .repeat(70));
  console.log('COMPARAÇÃO DETALHADA: BANCO vs ARQUIVO');
  console.log('=' .repeat(70));
  
  // Obter dados do banco agrupados por data e produto
  console.log('\n1. Obtendo dados do banco...');
  const [bancoData] = await conn.execute(`
    SELECT 
      DATE_FORMAT(s.saleDate, '%Y-%m-%d') as data,
      p.name as item,
      SUM(si.quantity * si.unitPrice) as total_banco,
      SUM(si.quantity) as quant_banco,
      COUNT(*) as linhas_banco
    FROM sales s
    JOIN saleItems si ON s.id = si.saleId
    LEFT JOIN products p ON si.productId = p.id
    WHERE YEAR(s.saleDate) = 2024 
      AND MONTH(s.saleDate) BETWEEN 5 AND 8
      AND s.status != 'CANCELLED'
    GROUP BY DATE_FORMAT(s.saleDate, '%Y-%m-%d'), p.name
  `);
  
  console.log(`   ${bancoData.length} combinações no banco`);
  
  // Criar mapa do banco
  const bancoMap = {};
  for (const row of bancoData) {
    const key = `${row.data}|${row.item}`;
    bancoMap[key] = {
      total: Number(row.total_banco),
      quant: Number(row.quant_banco),
      linhas: row.linhas_banco
    };
  }
  
  // Carregar dados do arquivo
  console.log('\n2. Carregando dados do arquivo...');
  const arquivoData = JSON.parse(fs.readFileSync('/home/ubuntu/arquivo_agrupado.json', 'utf8'));
  console.log(`   ${arquivoData.length} combinações no arquivo`);
  
  // Comparar
  console.log('\n3. Comparando...');
  
  let totalDiffPositiva = 0;  // Arquivo > Banco (faltando no banco)
  let totalDiffNegativa = 0;  // Banco > Arquivo (extra no banco)
  const faltantes = [];
  const extras = [];
  
  for (const arq of arquivoData) {
    const key = `${arq.data}|${arq.item}`;
    const banco = bancoMap[key];
    
    if (!banco) {
      // Item não existe no banco
      faltantes.push({
        data: arq.data,
        item: arq.item,
        total: arq.total_arquivo,
        quant: arq.quant_arquivo
      });
      totalDiffPositiva += arq.total_arquivo;
    } else {
      const diff = arq.total_arquivo - banco.total;
      if (diff > 1) {  // Tolerância de R$ 1
        faltantes.push({
          data: arq.data,
          item: arq.item,
          total: diff,
          quant: arq.quant_arquivo - banco.quant,
          parcial: true
        });
        totalDiffPositiva += diff;
      } else if (diff < -1) {
        extras.push({
          data: arq.data,
          item: arq.item,
          total: Math.abs(diff)
        });
        totalDiffNegativa += Math.abs(diff);
      }
    }
  }
  
  console.log('\n' + '=' .repeat(70));
  console.log('RESULTADO:');
  console.log('=' .repeat(70));
  console.log(`\nItens FALTANTES no banco (arquivo > banco): ${faltantes.length}`);
  console.log(`  Total faltante: R$ ${totalDiffPositiva.toFixed(2)}`);
  
  console.log(`\nItens EXTRAS no banco (banco > arquivo): ${extras.length}`);
  console.log(`  Total extra: R$ ${totalDiffNegativa.toFixed(2)}`);
  
  console.log(`\nDiferença líquida: R$ ${(totalDiffPositiva - totalDiffNegativa).toFixed(2)}`);
  
  // Mostrar maiores faltantes
  console.log('\n' + '=' .repeat(70));
  console.log('MAIORES ITENS FALTANTES:');
  console.log('=' .repeat(70));
  
  faltantes.sort((a, b) => b.total - a.total);
  for (const f of faltantes.slice(0, 30)) {
    const tipo = f.parcial ? '(parcial)' : '';
    console.log(`  ${f.data} | ${f.item} | R$ ${f.total.toFixed(2)} ${tipo}`);
  }
  
  // Salvar lista de faltantes
  fs.writeFileSync('/home/ubuntu/itens_faltantes.json', JSON.stringify(faltantes, null, 2));
  console.log(`\nLista completa salva em /home/ubuntu/itens_faltantes.json`);
  
  await conn.end();
}

compare().catch(console.error);
