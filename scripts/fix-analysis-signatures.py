#!/usr/bin/env python3
"""
Fix sales analysis function signatures in db.ts to include companyId parameter.
The routers.ts already passes ctx.activeCompanyId as 3rd arg, so we need to add it
between endDate and filters in the db.ts signatures.
"""

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)

def apply_edit(content, old, new, label):
    count = content.count(old)
    if count == 0:
        print(f"  [SKIP] {label} - not found")
        return content, 0
    content = content.replace(old, new, 1)
    print(f"  [OK] {label}")
    return content, 1

db = read_file('/home/ubuntu/erp-demo/server/db.ts')
edits = 0

# Sales analysis functions that need companyId added between endDate and filters
# Pattern: (startDate: Date, endDate: Date, filters?) -> (startDate: Date, endDate: Date, companyId?: number, filters?)

sales_analysis_funcs = [
    'getSalesAnalysisByValue',
    'getSalesAnalysisByQuantity',
    'getSalesAnalysisByCategoryValue',
    'getSalesAnalysisByDay',
    'getSalesAnalysisByWeek',
    'getSalesAnalysisByMonth',
    'getSalesByProductAndDate',
    'getSalesAnalysisSummary',
]

for func in sales_analysis_funcs:
    old = f"export async function {func}(\n  startDate: Date, \n  endDate: Date,\n  filters?"
    new = f"export async function {func}(\n  startDate: Date, \n  endDate: Date,\n  companyId?: number,\n  filters?"
    db, n = apply_edit(db, old, new, f'{func} signature')
    edits += n

# getSalesAnalysisSummary has different filters format
# Check if it was already handled
if 'getSalesAnalysisSummary(\n  startDate: Date, \n  endDate: Date,\n  companyId?: number,\n  filters?' in db:
    print("  getSalesAnalysisSummary already has companyId")
else:
    print("  [WARN] getSalesAnalysisSummary may need manual fix")

# Now add the companyId filter inside the SQL WHERE for these functions
# They all use: let whereConditions = `WHERE s.status = 'ATIVA'`;
# We already added: if (companyId) whereConditions += ` AND s.companyId = ${companyId}`;
# from the previous script. Let's verify.

count = db.count("if (companyId) whereConditions += ` AND s.companyId = ${companyId}`")
print(f"\n  Sales companyId WHERE filters already present: {count}")

# Also fix getStockByCategory in closingQueries.ts
cq = read_file('/home/ubuntu/erp-demo/server/closingQueries.ts')
# Check if getStockByCategory has companyId
if 'getStockByCategory(startDate: string, endDate: string, year: number, month: number, companyId?: number)' in cq:
    print("  getStockByCategory already has companyId in closingQueries.ts")
else:
    print("  [WARN] getStockByCategory needs companyId in closingQueries.ts")

# Fix db.ts line 6093 - Expected 4 arguments but got 5
# This is likely getStockByCategory call inside getMonthlyClosing
# getStockByCategory(startDate, endDate, year, month, companyId) but the function only takes 4 args
# Let's check

write_file('/home/ubuntu/erp-demo/server/db.ts', db)
print(f"\n  Total edits: {edits}")
print("Done!")
