#!/usr/bin/env python3
"""
Add companyId filters to all whereConditions and whereClause in db.ts.
Strategy: After each `let whereConditions = ...` or `let whereClause = ...` line,
add a line that appends companyId filter if companyId is available.
"""

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)

# ============================================================
# DB.TS - Add companyId filter after each whereConditions/whereClause
# ============================================================
print("=== Fixing db.ts WHERE filters ===")
db = read_file('/home/ubuntu/erp-demo/server/db.ts')

lines = db.split('\n')
new_lines = []
edits = 0

i = 0
while i < len(lines):
    line = lines[i]
    new_lines.append(line)
    
    # Check if this line declares whereConditions or whereClause
    stripped = line.strip()
    
    # Skip if next line already has companyId filter
    has_filter_next = False
    if i + 1 < len(lines):
        next_stripped = lines[i+1].strip()
        if 'companyId' in next_stripped and ('whereConditions' in next_stripped or 'whereClause' in next_stripped):
            has_filter_next = True
    
    if not has_filter_next:
        if stripped.startswith('let whereConditions = ') and 'companyId' not in stripped:
            # Determine the table alias used in the WHERE
            # Check if it uses s. prefix (sales), po. (purchaseOrders), e. (expenses), or no prefix
            if 's.status' in stripped:
                filter_line = "    if (companyId) whereConditions += ` AND s.companyId = ${companyId}`;"
            elif 'po.status' in stripped:
                filter_line = "    if (companyId) whereConditions += ` AND po.companyId = ${companyId}`;"
            elif 'e.status' in stripped:
                filter_line = "    if (companyId) whereConditions += ` AND e.companyId = ${companyId}`;"
            elif 'status' in stripped and '.' not in stripped.split('status')[0][-3:]:
                # No table alias - direct column
                filter_line = "    if (companyId) whereConditions += ` AND companyId = ${companyId}`;"
            elif '1=1' in stripped:
                # Generic condition - check context
                filter_line = "    if (companyId) whereConditions += ` AND companyId = ${companyId}`;"
            else:
                # Default - use s. prefix for sales
                filter_line = "    if (companyId) whereConditions += ` AND s.companyId = ${companyId}`;"
            
            # Get indentation
            indent = len(line) - len(line.lstrip())
            filter_line = ' ' * indent + filter_line.strip()
            new_lines.append(filter_line)
            edits += 1
            print(f"  [OK] Line {i+1}: Added companyId filter for whereConditions")
        
        elif stripped.startswith('let whereClause = ') and 'companyId' not in stripped:
            if 'e.status' in stripped:
                filter_line = "    if (companyId) whereClause += ` AND e.companyId = ${companyId}`;"
            elif 's.status' in stripped:
                filter_line = "    if (companyId) whereClause += ` AND s.companyId = ${companyId}`;"
            else:
                filter_line = "    if (companyId) whereClause += ` AND companyId = ${companyId}`;"
            
            indent = len(line) - len(line.lstrip())
            filter_line = ' ' * indent + filter_line.strip()
            new_lines.append(filter_line)
            edits += 1
            print(f"  [OK] Line {i+1}: Added companyId filter for whereClause")
        
        # Also handle subqueryWhere
        elif stripped.startswith('let subqueryWhere = ') and 'companyId' not in stripped:
            if 's2.status' in stripped:
                filter_line = "    if (companyId) subqueryWhere += ` AND s2.companyId = ${companyId}`;"
            else:
                filter_line = "    if (companyId) subqueryWhere += ` AND companyId = ${companyId}`;"
            
            indent = len(line) - len(line.lstrip())
            filter_line = ' ' * indent + filter_line.strip()
            new_lines.append(filter_line)
            edits += 1
            print(f"  [OK] Line {i+1}: Added companyId filter for subqueryWhere")
    
    i += 1

db = '\n'.join(new_lines)
write_file('/home/ubuntu/erp-demo/server/db.ts', db)
print(f"\n  Total WHERE filter edits: {edits}")

# ============================================================
# CLOSINGQUERIES.TS - Fix getStockByCategory
# ============================================================
print("\n=== Fixing closingQueries.ts ===")
cq = read_file('/home/ubuntu/erp-demo/server/closingQueries.ts')

# Check if getStockByCategory already has companyId
if 'companyId' not in cq.split('getStockByCategory')[1][:200]:
    cq = cq.replace(
        'export async function getStockByCategory(startDate: string, endDate: string, year: number, month: number)',
        'export async function getStockByCategory(startDate: string, endDate: string, year: number, month: number, companyId?: number)'
    )
    print("  [OK] Added companyId to getStockByCategory signature")
else:
    print("  [SKIP] getStockByCategory already has companyId")

# Add companyId filter in stock query SQL
lines = cq.split('\n')
new_lines = []
for i, line in enumerate(lines):
    new_lines.append(line)
    stripped = line.strip()
    if stripped.startswith('let whereConditions') and 'companyId' not in stripped:
        has_filter_next = False
        if i + 1 < len(lines) and 'companyId' in lines[i+1]:
            has_filter_next = True
        if not has_filter_next:
            if 's.status' in stripped:
                indent = len(line) - len(line.lstrip())
                new_lines.append(' ' * indent + "if (companyId) whereConditions += ` AND s.companyId = ${companyId}`;")
                print(f"  [OK] Line {i+1}: Added companyId filter in closingQueries")
            elif 'po.status' in stripped:
                indent = len(line) - len(line.lstrip())
                new_lines.append(' ' * indent + "if (companyId) whereConditions += ` AND po.companyId = ${companyId}`;")
                print(f"  [OK] Line {i+1}: Added companyId filter in closingQueries")

cq = '\n'.join(new_lines)
write_file('/home/ubuntu/erp-demo/server/closingQueries.ts', cq)

print("\nDone!")
