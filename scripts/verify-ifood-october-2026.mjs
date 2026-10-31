import fs from 'fs';
import mysql from 'mysql2/promise';
const report=JSON.parse(fs.readFileSync('/home/ubuntu/upload/analise-ifood-outubro-2026/saneamento-ifood-outubro-2026-aplicado.json','utf8'));
const u=new URL(process.env.DATABASE_URL);
const db=await mysql.createConnection({host:u.hostname,port:Number(u.port||3306),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1),ssl:{rejectUnauthorized:true}});
const out={checked:0,errors:[],duplicatesChecked:0,stockAuditRows:0,mappings:[]};
try {
 for(const e of report.plan){
  const [links]=await db.query('SELECT saleId, ifoodOrderCode, orderValue, companyId, branchId FROM ifoodImportedOrders WHERE ifoodOrderId=?',[e.ifoodOrderId]);
  if(links.length!==1){out.errors.push({code:e.ifoodOrderCode,error:'UUID não possui vínculo único',links:links.length});continue;}
  const link=links[0];
  const [sales]=await db.query('SELECT id,status,subtotal,finalAmount FROM sales WHERE id=?',[link.saleId]);
  if(sales.length!==1){out.errors.push({code:e.ifoodOrderCode,error:'Venda canônica ausente'});continue;}
  const sale=sales[0];
  const [sums]=await db.query('SELECT COALESCE(SUM(totalPrice),0) total FROM saleItems WHERE saleId=?',[sale.id]);
  const actual=Number(sums[0].total), official=Number(e.officialTotal);
  if(sale.status!=='ACTIVE' || Number(sale.subtotal)!==official || Number(sale.finalAmount)!==official || actual!==official){out.errors.push({code:e.ifoodOrderCode,error:'Total ou status divergente',sale,itemsTotal:actual,official});}
  if(String(link.ifoodOrderCode).padStart(4,'0')!==e.ifoodOrderCode || Number(link.orderValue)!==official || Number(link.companyId)!==1){out.errors.push({code:e.ifoodOrderCode,error:'Vínculo iFood divergente',link,official});}
  for(const duplicate of e.duplicates){
   const [rows]=await db.query('SELECT status,cancellationReason FROM sales WHERE id=?',[duplicate.id]);
   out.duplicatesChecked++;
   if(rows.length!==1 || rows[0].status!=='CANCELLED' || !String(rows[0].cancellationReason||'').includes('SANEAMENTO-IFOOD-202610')) out.errors.push({code:e.ifoodOrderCode,error:'Duplicidade não cancelada corretamente',saleId:duplicate.id,rows});
  }
  out.checked++;
 }
 const [stockRows]=await db.query("SELECT COUNT(*) count FROM productMovements WHERE companyId=1 AND documentNumber LIKE 'SANEAMENTO-IFOOD-202610%'");
 out.stockAuditRows=Number(stockRows[0].count);
 const [mappings]=await db.query("SELECT ifoodSku,productId,quantityMultiplier,ifoodProductName FROM ifoodProductMappings WHERE ifoodSku IN ('VP3752667205938','VP9366898220104') ORDER BY ifoodSku");
 out.mappings=mappings;
 const [auditRows]=await db.query("SELECT COUNT(*) count FROM auditLog WHERE entityType IN ('VENDA_IFOOD_SANEAMENTO','SANEAMENTO_IFOOD_202610') AND companyId=1");
 out.auditRows=Number(auditRows[0].count);
 out.ok=out.errors.length===0;
 fs.writeFileSync('/home/ubuntu/upload/analise-ifood-outubro-2026/verificacao-saneamento-ifood-outubro-2026.json',JSON.stringify(out,null,2));
 console.log(JSON.stringify(out,null,2));
}finally{await db.end();}
