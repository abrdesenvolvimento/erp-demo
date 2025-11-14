import os
import mysql.connector
import csv
from datetime import datetime

# Conectar ao banco
db_url = os.environ.get('DATABASE_URL', '')
# Parse DATABASE_URL: mysql://user:pass@host:port/dbname
if db_url.startswith('mysql://'):
    db_url = db_url[8:]  # Remove mysql://
    
parts = db_url.split('@')
user_pass = parts[0].split(':')
host_db = parts[1].split('/')
host_port = host_db[0].split(':')

conn = mysql.connector.connect(
    host=host_port[0],
    port=int(host_port[1]) if len(host_port) > 1 else 3306,
    user=user_pass[0],
    password=user_pass[1],
    database=host_db[1].split('?')[0]
)

cursor = conn.cursor()

# Buscar produtos
cursor.execute("""
    SELECT 
        p.id,
        p.name,
        p.ean,
        p.uom,
        c.name as category,
        sc.name as subcategory,
        p.currentStock,
        p.minStock,
        p.avgCost,
        p.isComposite,
        p.active
    FROM products p
    LEFT JOIN categories c ON p.categoryId = c.id
    LEFT JOIN subcategories sc ON p.subcategoryId = sc.id
    ORDER BY p.id ASC
""")

products = cursor.fetchall()

# Gerar CSV
with open('/home/ubuntu/produtos_atualizados.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['ID', 'Nome', 'EAN', 'Unidade', 'Categoria', 'Subcategoria', 'Estoque Atual', 'Estoque Mínimo', 'Custo Médio', 'Produto Composto', 'Ativo'])
    
    for row in products:
        writer.writerow([
            row[0],  # id
            row[1],  # name
            row[2] or '',  # ean
            row[3],  # uom
            row[4] or '',  # category
            row[5] or '',  # subcategory
            row[6] or 0,  # currentStock
            row[7] or 0,  # minStock
            f"{float(row[8]):.2f}" if row[8] else '0.00',  # avgCost
            'Sim' if row[9] else 'Não',  # isComposite
            'Sim' if row[10] else 'Não'  # active
        ])

cursor.close()
conn.close()

print(f"✅ Exportados {len(products)} produtos para produtos_atualizados.csv")
