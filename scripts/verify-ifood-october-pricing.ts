import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { normalizeIfoodOrderPricing } from '../server/ifoodPricing';
const read=(p:string)=>fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));
const orders=read('/home/ubuntu/upload/Vendas-Out.json').filter((o:any)=>o.status_pedido==='CONCLUDED' && String(o.data_de_finalizacao_do_pedido||'').startsWith('2026-10'));
const items=read('/home/ubuntu/upload/Itens-Out.json'); const byId=new Map<string,any[]>();
for(const item of items) byId.set(item.id_pedido_ifood,[...(byId.get(item.id_pedido_ifood)||[]),item]);
const u=new URL(process.env.DATABASE_URL!);const db=await mysql.createConnection({host:u.hostname,port:Number(u.port||3306),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1),ssl:{rejectUnauthorized:true}});
try { const [rows]=await db.query<any[]>('SELECT ifoodSku, quantityMultiplier FROM ifoodProductMappings WHERE companyId=1 OR companyId IS NULL'); const multipliers=new Map(rows.map(r=>[String(r.ifoodSku).trim(),Number(r.quantityMultiplier||1)])); const errors:any[]=[];
 for(const order of orders){const source=byId.get(order.id_pedido_ifood)||[];const result=normalizeIfoodOrderPricing(source.map((i:any)=>({...i,quantidadeMultiplicadora:multipliers.get(String(i.sku||'').trim())||1})),order.valor_total_dos_itens);if(!result.ok)errors.push({code:order.codigo_do_pedido_no_ifood,id:order.id_pedido_ifood,reason:result.reason});}
 const result={orders:orders.length,normalized:orders.length-errors.length,errors};fs.writeFileSync('/home/ubuntu/upload/analise-ifood-outubro-2026/verificacao-normalizacao-ifood-outubro-2026.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2)); if(errors.length)process.exitCode=1;
} finally {await db.end();}
