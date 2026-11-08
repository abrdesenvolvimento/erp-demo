import { sql } from 'drizzle-orm';
import { getDb, getSales, getSalesAnalysisSummary, getDeliveryProductAnalysis, effectiveDeliveryPlatformSql, deliveryPlatformFilterSql } from '../server/db';
import { listConsumption, getConsumptionEmployees, getConsumptionProducts } from '../server/consumption';

// Somente SELECTs: não cria funcionários, consumos, movimentos ou vendas.
async function main() {
  const db = await getDb();
  if (!db) throw new Error('Conexão de leitura indisponível');
  const output: Record<string, unknown> = {};
  const metadata = await db.execute(sql`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND ((TABLE_NAME='sales' AND COLUMN_NAME='deliveryPlatform') OR (TABLE_NAME IN ('consumptionEmployees','consumptionRecords','consumptionItems','consumptionStockItems') AND COLUMN_NAME='companyId'))`);
  if ((metadata[0] as unknown as unknown[]).length !== 5) throw new Error('Migração incompleta');
  output.schemaVerified = true;
  for (const companyId of [1, 2]) {
    const branchId = companyId;
    const scope = { companyId, branchId };
    const list = await listConsumption(db, { ...scope, page: 1, pageSize: 20 });
    const employees = await getConsumptionEmployees(db, scope, true);
    const products = await getConsumptionProducts(db, scope);
    const violations = list.items.filter(row => row.companyId !== companyId || row.branchId !== branchId);
    if (violations.length) throw new Error('Vazamento de empresa na consulta de Consumo');
    const latest = await getSales({ companyId, saleType: 'DELIVERY', limit: 10 });
    if (latest.some(row => row.companyId !== companyId)) throw new Error('Vazamento de empresa na consulta de Vendas');
    const platforms = await db.execute(sql.raw(`SELECT classified.platform,COUNT(*) AS records FROM (SELECT ${effectiveDeliveryPlatformSql()} AS platform FROM sales WHERE companyId=${companyId} AND saleType='DELIVERY' AND status='ACTIVE') classified GROUP BY classified.platform`));
    const filtered = await db.execute(sql.raw(`SELECT COUNT(*) AS records FROM sales WHERE companyId=${companyId} AND status='ACTIVE'${deliveryPlatformFilterSql('IFOOD')}`));
    const grouped = (platforms[0] as unknown as Array<{ platform: string | null; records: number | string }>);
    const expected = Number(grouped.find(row => row.platform === 'IFOOD')?.records ?? 0);
    const actual = Number((filtered[0] as unknown as Array<{ records: number | string }>)[0]?.records ?? 0);
    if (expected !== actual) throw new Error('Filtro iFood diverge da classificação efetiva');
    const analysis = await getSalesAnalysisSummary(new Date('2026-11-01T03:00:00.000Z'), new Date('2026-11-08T03:00:00.000Z'), companyId, { deliveryPlatform: 'IFOOD' });
    const delivery = await getDeliveryProductAnalysis('2026-11-01', '2026-11-08', undefined, companyId, undefined, '99FOOD');
    if (!Array.isArray(delivery.products) || !Number.isFinite(Number(analysis.totalSales))) throw new Error('Agregados de análise inválidos');
    output[`company_${companyId}`] = { consumptionRecords: list.total, employees: employees.length, productsReadable: products.length, activeConsumptionCost: list.summary.totalCost, salesReadable: latest.length, originGroups: grouped, ifoodFilterMatches: true, analysisReadVerified: true, deliveryReadVerified: true };
  }
  console.log(JSON.stringify(output, null, 2));
}
main().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
