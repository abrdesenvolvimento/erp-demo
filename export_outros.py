import mysql.connector
import csv
import os

# Conectar ao banco
conn = mysql.connector.connect(
    host=os.environ.get('DB_HOST', 'gateway01.us-west-2.prod.aws.tidbcloud.com'),
    port=int(os.environ.get('DB_PORT', 4000)),
    user=os.environ['DB_USER'],
    password=os.environ['DB_PASSWORD'],
    database=os.environ['DB_NAME'],
    ssl_ca='/etc/ssl/certs/ca-certificates.crt'
)

cursor = conn.cursor(dictionary=True)

query = """
SELECT 
  p.id, 
  p.name as nome_produto, 
  p.ean, 
  c.name as categoria, 
  sc.name as subcategoria,
  p.uom as unidade,
  p.currentStock as estoque_atual,
  p.minStock as estoque_minimo,
  p.avgCost as custo_medio,
  GROUP_CONCAT(CONCAT(sch.name, ': R$ ', pp.price) SEPARATOR ' | ') as precos_por_canal
FROM products p
INNER JOIN categories c ON p.categoryId = c.id
LEFT JOIN subcategories sc ON p.subcategoryId = sc.id
LEFT JOIN productPrices pp ON p.id = pp.productId
LEFT JOIN salesChannels sch ON pp.channelId = sch.id
WHERE c.name = 'Outros'
GROUP BY p.id, p.name, p.ean, c.name, sc.name, p.uom, p.currentStock, p.minStock, p.avgCost
ORDER BY p.name
"""

cursor.execute(query)
rows = cursor.fetchall()

# Gerar CSV
with open('/home/ubuntu/produtos_outros.csv', 'w', newline='', encoding='utf-8-sig') as f:
    if rows:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
        print(f"✅ Arquivo gerado com {len(rows)} produtos")
    else:
        print("⚠️ Nenhum produto encontrado na categoria Outros")

cursor.close()
conn.close()
