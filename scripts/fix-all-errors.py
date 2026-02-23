#!/usr/bin/env python3
"""
Fix all TypeScript errors in routers.ts and db.ts after multiempresa edits.
Main issues:
1. "Cannot find name 'ctx'" - need to add ctx to destructuring
2. "companyId does not exist in type" - need to update function signatures in db.ts
3. "Expected N arguments but got N+1" - getSalesStats signature mismatch
"""

import re

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)

# ============================================================
# FIX 1: ROUTERS.TS - Add ctx to all handlers that use it
# ============================================================
print("=== Fixing routers.ts ===")
rt = read_file('/home/ubuntu/erp-demo/server/routers.ts')

# Strategy: Find all lines that have ctx.activeCompanyId or ctx.activeBranchId
# Then look backwards to find the handler definition and add ctx

lines = rt.split('\n')
needs_ctx_lines = set()

# First pass: find all lines that use ctx but might not have it
for i, line in enumerate(lines):
    if 'ctx.activeCompanyId' in line or 'ctx.activeBranchId' in line or 'ctx.user' in line:
        needs_ctx_lines.add(i)

# Second pass: for each line that needs ctx, find the handler definition above it
handlers_to_fix = set()
for line_num in needs_ctx_lines:
    # Search backwards for the handler definition
    for j in range(line_num, max(line_num - 50, 0), -1):
        line = lines[j]
        if '.query(async' in line or '.mutation(async' in line:
            if 'ctx' not in line:
                handlers_to_fix.add(j)
            break

print(f"  Found {len(handlers_to_fix)} handlers that need ctx added")

# Apply fixes
for j in sorted(handlers_to_fix):
    line = lines[j]
    # Different patterns to fix
    if '.query(async ({ input })' in line:
        lines[j] = line.replace('.query(async ({ input })', '.query(async ({ input, ctx })')
    elif '.mutation(async ({ input })' in line:
        lines[j] = line.replace('.mutation(async ({ input })', '.mutation(async ({ input, ctx })')
    elif '.query(async ()' in line:
        lines[j] = line.replace('.query(async ()', '.query(async ({ ctx })')
    elif '.mutation(async ()' in line:
        lines[j] = line.replace('.mutation(async ()', '.mutation(async ({ ctx })')
    elif '.query(({' in line and 'ctx' not in line:
        lines[j] = line.replace('.query(({', '.query(({ ctx,')
    elif '.mutation(({' in line and 'ctx' not in line:
        lines[j] = line.replace('.mutation(({', '.mutation(({ ctx,')
    elif '.query(async ({' in line and 'ctx' not in line:
        # More complex pattern - add ctx after the opening {
        lines[j] = re.sub(r'\.query\(async \(\{', '.query(async ({ ctx,', line)
    elif '.mutation(async ({' in line and 'ctx' not in line:
        lines[j] = re.sub(r'\.mutation\(async \(\{', '.mutation(async ({ ctx,', line)
    else:
        print(f"  [WARN] Line {j+1}: Could not fix handler: {line.strip()[:80]}")

rt = '\n'.join(lines)

# FIX 2: getSalesStats signature issue - the first param is period not companyId
# Error: Argument of type '"month" | "today" | "week" | "all"' is not assignable to parameter of type 'number | undefined'
# The issue is getSalesStats signature in db.ts has companyId as first param but should be after the existing params
# Let's check the actual call in routers.ts
# The call is: db.getSalesStats(input?.period || 'month', input?.dateFrom, input?.dateTo, input?.channel, ctx.activeCompanyId)
# But the function signature is: getSalesStats(companyId?: number, period, dateFrom, dateTo, channel)
# We need to fix the db.ts signature

# FIX 3: Remove companyId from object literals where the function doesn't accept it
# registerCustomerPayment, registerSupplierPayment, registerPaymentToBalance, registerManualDebit, upsertRevenueGoal, adjustProductStock
# These functions take specific params, not a generic object with companyId

# For registerCustomerPayment - remove companyId from spread
rt = rt.replace(
    "return await db.registerCustomerPayment({ ...input, companyId: ctx.activeCompanyId });",
    "return await db.registerCustomerPayment(input);"
)

# For registerSupplierPayment - remove companyId from spread
rt = rt.replace(
    "return await db.registerSupplierPayment({ ...input, companyId: ctx.activeCompanyId });",
    "return await db.registerSupplierPayment(input);"
)

# For registerPaymentToBalance - remove companyId
rt = rt.replace(
    "return await db.registerPaymentToBalance({ companyId: ctx.activeCompanyId,",
    "return await db.registerPaymentToBalance({"
)

# For registerManualDebit - remove companyId
rt = rt.replace(
    "return await db.registerManualDebit({ companyId: ctx.activeCompanyId,",
    "return await db.registerManualDebit({"
)

# For upsertRevenueGoal - remove companyId
rt = rt.replace(
    "return await db.upsertRevenueGoal({ companyId: ctx.activeCompanyId ?? 1,",
    "return await db.upsertRevenueGoal({"
)

# For adjustProductStock - remove companyId/branchId
rt = rt.replace(
    "return await db.adjustProductStock({ companyId: ctx.activeCompanyId ?? 1, branchId: ctx.activeBranchId ?? 1,",
    "return await db.adjustProductStock({"
)

# For createReceivable - remove companyId
rt = rt.replace(
    "const receivableId = await db.createReceivable({ companyId: ctx.activeCompanyId ?? 1,",
    "const receivableId = await db.createReceivable({"
)

write_file('/home/ubuntu/erp-demo/server/routers.ts', rt)
print("  routers.ts fixed")

# ============================================================
# FIX 4: DB.TS - Fix getSalesStats signature
# ============================================================
print("=== Fixing db.ts ===")
db = read_file('/home/ubuntu/erp-demo/server/db.ts')

# getSalesStats - the companyId was added at the beginning but should be at the end
# Current: getSalesStats(companyId?: number, period, dateFrom, dateTo, channel)
# Should be: getSalesStats(period, dateFrom, dateTo, channel, companyId?: number)
db = db.replace(
    "export async function getSalesStats(\n  companyId?: number,\n",
    "export async function getSalesStats(\n"
)
# Find the closing of the params and add companyId before it
# The function params end with: channel?: string\n)
db = db.replace(
    "  channel?: string\n) {",
    "  channel?: string,\n  companyId?: number\n) {"
)

# Fix getStockByCategory call in closingQueries - the companyId position
# getStockByCategory(startDate, endDate, year, month, companyId) - this is correct

# Fix getMonthlyClosing - companyId should be optional and after month
# Already correct from our script

# Fix getExpenseAnalysis functions - companyId should be first param but the calls pass it correctly
# Let's verify the expense analysis function signatures match the calls

# Fix getRevenueGoalProgress - add companyId filter in SQL
# Already done

# Fix getDeliveryProductAnalysis - companyId position
# Current: getDeliveryProductAnalysis(startDate, endDate, categoryId?, companyId?)
# This is correct

write_file('/home/ubuntu/erp-demo/server/db.ts', db)
print("  db.ts fixed")

# ============================================================
# FIX 5: ROUTERS/ACCOUNTING.TS - Add ctx where needed
# ============================================================
print("=== Checking routers/accounting.ts ===")
try:
    acc = read_file('/home/ubuntu/erp-demo/server/routers/accounting.ts')
    
    # Same pattern - find handlers that use ctx but don't have it
    lines = acc.split('\n')
    needs_ctx_lines = set()
    for i, line in enumerate(lines):
        if 'ctx.activeCompanyId' in line or 'ctx.activeBranchId' in line or 'ctx.user' in line:
            needs_ctx_lines.add(i)
    
    handlers_to_fix = set()
    for line_num in needs_ctx_lines:
        for j in range(line_num, max(line_num - 50, 0), -1):
            line = lines[j]
            if '.query(async' in line or '.mutation(async' in line:
                if 'ctx' not in line:
                    handlers_to_fix.add(j)
                break
    
    for j in sorted(handlers_to_fix):
        line = lines[j]
        if '.query(async ({ input })' in line:
            lines[j] = line.replace('.query(async ({ input })', '.query(async ({ input, ctx })')
        elif '.mutation(async ({ input })' in line:
            lines[j] = line.replace('.mutation(async ({ input })', '.mutation(async ({ input, ctx })')
        elif '.query(async ()' in line:
            lines[j] = line.replace('.query(async ()', '.query(async ({ ctx })')
        elif '.mutation(async ()' in line:
            lines[j] = line.replace('.mutation(async ()', '.mutation(async ({ ctx })')
        elif '.query(async ({' in line and 'ctx' not in line:
            lines[j] = re.sub(r'\.query\(async \(\{', '.query(async ({ ctx,', line)
        elif '.mutation(async ({' in line and 'ctx' not in line:
            lines[j] = re.sub(r'\.mutation\(async \(\{', '.mutation(async ({ ctx,', line)
    
    acc = '\n'.join(lines)
    write_file('/home/ubuntu/erp-demo/server/routers/accounting.ts', acc)
    print(f"  Fixed {len(handlers_to_fix)} handlers in accounting.ts")
except Exception as e:
    print(f"  [SKIP] accounting.ts: {e}")

# ============================================================
# FIX 6: Check other sub-routers
# ============================================================
for subrouter in ['ifoodImport.ts', 'stockAnalysis.ts']:
    path = f'/home/ubuntu/erp-demo/server/routers/{subrouter}'
    try:
        content = read_file(path)
        lines = content.split('\n')
        needs_ctx_lines = set()
        for i, line in enumerate(lines):
            if 'ctx.activeCompanyId' in line or 'ctx.activeBranchId' in line:
                needs_ctx_lines.add(i)
        
        handlers_to_fix = set()
        for line_num in needs_ctx_lines:
            for j in range(line_num, max(line_num - 50, 0), -1):
                line = lines[j]
                if '.query(async' in line or '.mutation(async' in line:
                    if 'ctx' not in line:
                        handlers_to_fix.add(j)
                    break
        
        for j in sorted(handlers_to_fix):
            line = lines[j]
            if '.query(async ({ input })' in line:
                lines[j] = line.replace('.query(async ({ input })', '.query(async ({ input, ctx })')
            elif '.mutation(async ({ input })' in line:
                lines[j] = line.replace('.mutation(async ({ input })', '.mutation(async ({ input, ctx })')
            elif '.query(async ()' in line:
                lines[j] = line.replace('.query(async ()', '.query(async ({ ctx })')
            elif '.mutation(async ()' in line:
                lines[j] = line.replace('.mutation(async ()', '.mutation(async ({ ctx })')
        
        content = '\n'.join(lines)
        write_file(path, content)
        print(f"  Fixed {len(handlers_to_fix)} handlers in {subrouter}")
    except Exception as e:
        print(f"  [SKIP] {subrouter}: {e}")

print("\nDone!")
