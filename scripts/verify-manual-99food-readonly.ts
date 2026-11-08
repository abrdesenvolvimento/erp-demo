import { sql } from 'drizzle-orm';
import { getDb, getSales, getSale, getSalesForExport, getSalesStats, getSalesAnalysisSummary, getDeliveryProductAnalysis, deliveryPlatformFilterSql } from '../server/db';

// SOMENTE LEITURA: nenhum UPDATE, INSERT, DELETE, estorno ou nova venda.
const ids = [216900001, 216900002, 216900003, 216900004, 216900005, 216900006, 216900007, 216900008];
async function main() {
  const db = await getDb();
  if (!db) throw new Error('Banco indisponível para conferência');
  const dateFrom = '2026-11-08', dateTo = '2026-11-08';
  const readList = await getSales({ companyId: 1, dateFrom, dateTo, saleType: 'DELIVERY', deliveryPlatform: '99FOOD' });
  const targets = readList.filter(row => ids.includes(Number(row.id)));
  if (targets.length !== ids.length || targets.some(row => row.effectiveDeliveryPlatform !== '99FOOD')) throw new Error('Nem todos os pedidos do print foram identificados como 99Food');
  const detail = await getSale(ids[0], 1);
  if (detail?.effectiveDeliveryPlatform !== '99FOOD') throw new Error('Detalhe diverge da lista');
  const otherCompany = await getSale(ids[0], 2);
  if (otherCompany) throw new Error('Detalhe de outra empresa exposto');
  const exported = await getSalesForExport({ companyId: 1, startDate: new Date(`${dateFrom}T12:00:00Z`), endDate: new Date(`${dateTo}T12:00:00Z`), saleType: 'DELIVERY', deliveryPlatform: '99FOOD' });
  if (exported.some(row => row.effectiveDeliveryPlatform !== '99FOOD')) throw new Error('Exportação com origem divergente');
  const stats = await getSalesStats('all', dateFrom, dateTo, 'DELIVERY', 1, '99FOOD');
  const query = await db.execute(sql.raw(`SELECT COUNT(*) AS count,COALESCE(SUM(finalAmount),0) AS total FROM sales WHERE companyId=1 AND status!='CANCELLED' AND saleDate>='${dateFrom} 03:00:00' AND saleDate<DATE_ADD('${dateTo}',INTERVAL 1 DAY)+INTERVAL 3 HOUR${deliveryPlatformFilterSql('99FOOD')}`));
  const aggregate = (query[0] as unknown as Array<{ count: string | number; total: string }>)[0];
  if (Number(stats.total.count) !== Number(aggregate.count) || Number(stats.total.total) !== Number(aggregate.total)) throw new Error('Indicadores divergem do predicado de origem');
  const analysis = await getSalesAnalysisSummary(new Date(`${dateFrom}T03:00:00Z`),new Date(`${dateTo}T03:00:00Z`),1,{ deliveryPlatform:'99FOOD' });
  const delivery = await getDeliveryProductAnalysis(dateFrom,dateTo,undefined,1,3,'99FOOD');
  if (!Number.isFinite(Number(analysis.totalSales)) || !Array.isArray(delivery.products)) throw new Error('Agregados não executaram corretamente');
  console.log(JSON.stringify({ readOnly: true, verifiedOrders: targets.length, origin: '99FOOD', scopedDetail: true, listAndStatsAgree: true, exportVerified: true, analysesExecuted: true, orders: targets.map(row => ({ id: row.id, pedido: row.platformOrderId, channelId: row.channelId, stored: row.deliveryPlatform, effective: row.effectiveDeliveryPlatform, total: row.finalAmount })) },null,2));
}
main().then(()=>process.exit(0)).catch(error=>{console.error(error.message);process.exit(1);});
