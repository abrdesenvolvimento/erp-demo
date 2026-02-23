#!/usr/bin/env python3
"""
Script COMPLETO para Fase 2 Multiempresa.
Faz todas as edições em:
1. schema.ts - Adicionar companyId/branchId nas tabelas operacionais
2. db.ts - Adicionar companyId como parâmetro e filtro
3. closingQueries.ts - Adicionar companyId
4. routers.ts - Passar ctx.activeCompanyId
5. context.ts - Mudar null para undefined
"""

import re
import sys

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)

def apply_edit(content, old, new, label, all_occurrences=False):
    count = content.count(old)
    if count == 0:
        print(f"  [SKIP] {label} - not found")
        return content, 0
    if all_occurrences:
        content = content.replace(old, new)
        print(f"  [OK] {label} ({count}x)")
        return content, count
    else:
        content = content.replace(old, new, 1)
        print(f"  [OK] {label}")
        return content, 1

total_edits = 0

# ============================================================
# PART 1: SCHEMA.TS - Add companyId/branchId to operational tables
# ============================================================
print("\n=== PART 1: schema.ts ===")
schema = read_file('/home/ubuntu/erp-demo/drizzle/schema.ts')
edits = 0

# Tables that need companyId/branchId added (exist in DB but not in schema)
# We add after the id field in each table
tables_to_update = {
    'sales': 'export const sales = mysqlTable("sales", {\n  id: int("id").primaryKey().autoincrement(),',
    'saleItems': 'export const saleItems = mysqlTable("saleItems", {\n  id: int("id").primaryKey().autoincrement(),',
    'purchaseOrders': 'export const purchaseOrders = mysqlTable("purchaseOrders", {\n  id: int("id").primaryKey().autoincrement(),',
    'purchaseOrderItems': 'export const purchaseOrderItems = mysqlTable("purchaseOrderItems", {\n  id: int("id").primaryKey().autoincrement(),',
    'expenses': 'export const expenses = mysqlTable("expenses", {\n  id: int("id").primaryKey().autoincrement(),',
    'receivables': 'export const receivables = mysqlTable("receivables", {\n  id: int("id").primaryKey().autoincrement(),',
    'revenueGoals': 'export const revenueGoals = mysqlTable("revenueGoals", {\n  id: int("id").primaryKey().autoincrement(),',
    'managementAccounts': 'export const managementAccounts = mysqlTable("managementAccounts", {\n  id: int("id").primaryKey().autoincrement(),',
    'expenseCategories': 'export const expenseCategories = mysqlTable("expenseCategories", {\n  id: int("id").primaryKey().autoincrement(),',
}

for table_name, old_pattern in tables_to_update.items():
    new_pattern = old_pattern + '\n  companyId: int("companyId").notNull().default(1),\n  branchId: int("branchId").notNull().default(1),'
    schema, n = apply_edit(schema, old_pattern, new_pattern, f"schema: {table_name}")
    edits += n

write_file('/home/ubuntu/erp-demo/drizzle/schema.ts', schema)
total_edits += edits
print(f"  Schema edits: {edits}")

# ============================================================
# PART 2: CONTEXT.TS - Change null to undefined
# ============================================================
print("\n=== PART 2: context.ts ===")
ctx = read_file('/home/ubuntu/erp-demo/server/_core/context.ts')
edits = 0

ctx, n = apply_edit(ctx, 'activeCompanyId: number | null;', 'activeCompanyId: number | undefined;', 'context type companyId')
edits += n
ctx, n = apply_edit(ctx, 'activeBranchId: number | null;', 'activeBranchId: number | undefined;', 'context type branchId')
edits += n
ctx, n = apply_edit(ctx, 'let activeCompanyId: number | null = null;', 'let activeCompanyId: number | undefined = undefined;', 'context init companyId')
edits += n
ctx, n = apply_edit(ctx, 'let activeBranchId: number | null = null;', 'let activeBranchId: number | undefined = undefined;', 'context init branchId')
edits += n
ctx = ctx.replace("parseInt(String(companyHeader), 10) || null", "parseInt(String(companyHeader), 10) || undefined")
ctx = ctx.replace("parseInt(String(branchHeader), 10) || null", "parseInt(String(branchHeader), 10) || undefined")
ctx = ctx.replace("parseInt(opts.req.cookies.activeCompanyId, 10) || null", "parseInt(opts.req.cookies.activeCompanyId, 10) || undefined")
ctx = ctx.replace("parseInt(opts.req.cookies.activeBranchId, 10) || null", "parseInt(opts.req.cookies.activeBranchId, 10) || undefined")
edits += 4

write_file('/home/ubuntu/erp-demo/server/_core/context.ts', ctx)
total_edits += edits
print(f"  Context edits: {edits}")

# ============================================================
# PART 3: DB.TS - Add companyId parameter and filters
# ============================================================
print("\n=== PART 3: db.ts ===")
db = read_file('/home/ubuntu/erp-demo/server/db.ts')
edits = 0

# --- Group A: Functions that take filters object - add companyId to filters ---

# getSales
db, n = apply_edit(db,
    'export async function getSales(filters?: { saleType?: string; customerId?: number; limit?: number; dateFrom?: string; dateTo?: string })',
    'export async function getSales(filters?: { saleType?: string; customerId?: number; limit?: number; dateFrom?: string; dateTo?: string; companyId?: number })',
    'db: getSales signature')
edits += n

# getSalesForExport
db, n = apply_edit(db,
    'export async function getSalesForExport(filters?: {',
    'export async function getSalesForExport(filters?: { companyId?: number;',
    'db: getSalesForExport signature')
edits += n

# getPurchaseOrders
db, n = apply_edit(db,
    'export async function getPurchaseOrders(filters?: { status?: string; supplierId?: number; startDate?: Date; endDate?: Date; docNumber?: string; minValue?: number; maxValue?: number })',
    'export async function getPurchaseOrders(filters?: { status?: string; supplierId?: number; startDate?: Date; endDate?: Date; docNumber?: string; minValue?: number; maxValue?: number; companyId?: number })',
    'db: getPurchaseOrders signature')
edits += n

# getExpenses
db, n = apply_edit(db,
    'export async function getExpenses(filters?: {',
    'export async function getExpenses(filters?: { companyId?: number;',
    'db: getExpenses signature')
edits += n

# listReceivables
db, n = apply_edit(db,
    'export async function listReceivables(filters?: {',
    'export async function listReceivables(filters?: { companyId?: number;',
    'db: listReceivables signature')
edits += n

# getPaymentHistory
db, n = apply_edit(db,
    'export async function getPaymentHistory(filters: {',
    'export async function getPaymentHistory(filters: { companyId?: number;',
    'db: getPaymentHistory signature')
edits += n

# getPendingExpenseInstallments
db, n = apply_edit(db,
    'export async function getPendingExpenseInstallments(filters?: {',
    'export async function getPendingExpenseInstallments(filters?: { companyId?: number;',
    'db: getPendingExpenseInstallments signature')
edits += n

# listManagementAccounts
db, n = apply_edit(db,
    'export async function listManagementAccounts(filters?: {',
    'export async function listManagementAccounts(filters?: { companyId?: number;',
    'db: listManagementAccounts signature')
edits += n

# --- Group B: Functions that take simple params - add companyId param ---

simple_param_functions = [
    ('getSalesStats(\n', 'getSalesStats(\n  companyId?: number,\n'),
    ('getSalesCalendar(year: number, month: number)', 'getSalesCalendar(year: number, month: number, companyId?: number)'),
    ('getSalesMonthlyStats(year: number)', 'getSalesMonthlyStats(year: number, companyId?: number)'),
    ('cancelSale(saleId: number, userId: string, reason?: string)', 'cancelSale(saleId: number, userId: string, reason?: string, companyId?: number)'),
    ('searchProducts(searchTerm: string)', 'searchProducts(searchTerm: string, companyId?: number)'),
    ('getExpenseCategories(activeOnly = true)', 'getExpenseCategories(activeOnly = true, companyId?: number)'),
    ('getReceivablesSummary()', 'getReceivablesSummary(companyId?: number)'),
    ('getCustomersWithPendingReceivables()', 'getCustomersWithPendingReceivables(companyId?: number)'),
    ('getTotalPendingReceivables()', 'getTotalPendingReceivables(companyId?: number)'),
    ('getCustomerReceivableDetail(customerId: number)', 'getCustomerReceivableDetail(customerId: number, companyId?: number)'),
    ('listPendingReceivableInstallments(customerId?: number)', 'listPendingReceivableInstallments(customerId?: number, companyId?: number)'),
    ('listOverdueReceivableInstallments()', 'listOverdueReceivableInstallments(companyId?: number)'),
    ('getSuppliersWithPendingPayables()', 'getSuppliersWithPendingPayables(companyId?: number)'),
    ('getAllSuppliersWithHistory()', 'getAllSuppliersWithHistory(companyId?: number)'),
    ('getTotalPendingPayables()', 'getTotalPendingPayables(companyId?: number)'),
    ('getSupplierPayableDetail(supplierId: number)', 'getSupplierPayableDetail(supplierId: number, companyId?: number)'),
    ('getPayablesCalendar(year: number, month: number)', 'getPayablesCalendar(year: number, month: number, companyId?: number)'),
    ('getCustomersWithBalance()', 'getCustomersWithBalance(companyId?: number)'),
    ('getCustomerAccountHistory(customerId: number)', 'getCustomerAccountHistory(customerId: number, companyId?: number)'),
    ('getDashboardMonthlyRevenue()', 'getDashboardMonthlyRevenue(companyId?: number)'),
    ('getDashboardDailyRevenue()', 'getDashboardDailyRevenue(companyId?: number)'),
    ('getDashboardMonthlyPurchases()', 'getDashboardMonthlyPurchases(companyId?: number)'),
    ('getPurchaseTotalCurrentMonth()', 'getPurchaseTotalCurrentMonth(companyId?: number)'),
    ('getPurchaseTotalByDocType()', 'getPurchaseTotalByDocType(companyId?: number)'),
    ('getGrossMarginByCategory()', 'getGrossMarginByCategory(companyId?: number)'),
    ('getDeliveryNetMarginOptimized()', 'getDeliveryNetMarginOptimized(companyId?: number)'),
    ('getRevenueGoals(year?: number)', 'getRevenueGoals(year?: number, companyId?: number)'),
    ('getRevenueGoal(year: number, month: number, channelId?: number | null)', 'getRevenueGoal(year: number, month: number, channelId?: number | null, companyId?: number)'),
    ('getRevenueGoalProgress(year: number, month: number)', 'getRevenueGoalProgress(year: number, month: number, companyId?: number)'),
    ('getAllRevenueGoalHistory(year: number)', 'getAllRevenueGoalHistory(year: number, companyId?: number)'),
    ('listManagementAccountsForSelect()', 'listManagementAccountsForSelect(companyId?: number)'),
    ('listManagementAccountsGrouped()', 'listManagementAccountsGrouped(companyId?: number)'),
    ('getMonthlyClosing(year: number, month: number, skipExtras = false)', 'getMonthlyClosing(year: number, month: number, companyId?: number, skipExtras = false)'),
    ('getYearlyClosing(year: number)', 'getYearlyClosing(year: number, companyId?: number)'),
    ('getProductMovements(productId: number, filters?:', 'getProductMovements(productId: number, companyId?: number, filters?:'),
]

for old, new in simple_param_functions:
    db, n = apply_edit(db, 'export async function ' + old, 'export async function ' + new, f'db: {old.split("(")[0]} signature')
    edits += n

# getSalesAnalysis functions - these take (startDate, endDate, filters) - add companyId after endDate
analysis_functions = [
    'getSalesAnalysisByValue',
    'getSalesAnalysisByQuantity',
    'getSalesAnalysisByCategoryValue',
    'getSalesAnalysisByDay',
    'getSalesAnalysisByWeek',
    'getSalesAnalysisByMonth',
    'getSalesByProductAndDate',
    'getSalesAnalysisSummary',
]

for func in analysis_functions:
    old = f'export async function {func}(\n  startDate: string,\n  endDate: string,'
    new = f'export async function {func}(\n  startDate: string,\n  endDate: string,\n  companyId?: number,'
    db, n = apply_edit(db, old, new, f'db: {func} signature')
    edits += n

# getDeliveryProductAnalysis - special case
db, n = apply_edit(db,
    'export async function getDeliveryProductAnalysis(\n  startDate: string,\n  endDate: string,\n  categoryId?: number',
    'export async function getDeliveryProductAnalysis(\n  startDate: string,\n  endDate: string,\n  categoryId?: number,\n  companyId?: number',
    'db: getDeliveryProductAnalysis signature')
edits += n

# Expense analysis functions
expense_analysis_functions = [
    'getExpenseAnalysisByCategory',
    'getExpenseAnalysisByMonth',
    'getExpenseAnalysisByCategoryAndMonth',
    'getExpenseAnalysisDetail',
    'getExpenseAnalysisSummary',
    'getExpenseHierarchicalData',
]

for func in expense_analysis_functions:
    old = f'export async function {func}('
    new = f'export async function {func}(companyId: number | undefined,'
    db, n = apply_edit(db, old, new, f'db: {func} signature')
    edits += n

# --- Group C: Add WHERE companyId filters inside SQL raw queries ---
# For functions that use sql.raw or template literals with WHERE clauses

# getSales - add companyId filter in the WHERE
db, n = apply_edit(db,
    "const conditions: any[] = [eq(sales.status, 'ATIVA')];",
    "const conditions: any[] = [eq(sales.status, 'ATIVA')];\n    if (filters?.companyId) conditions.push(eq(sales.companyId, filters.companyId));",
    'db: getSales WHERE filter', True)
edits += n

# getPurchaseOrders - add companyId filter
db, n = apply_edit(db,
    "const conditions: any[] = [];\n\n  if (filters?.status)",
    "const conditions: any[] = [];\n  if (filters?.companyId) conditions.push(eq(purchaseOrders.companyId, filters.companyId));\n\n  if (filters?.status)",
    'db: getPurchaseOrders WHERE filter')
edits += n

# getExpenses - add companyId filter
db, n = apply_edit(db,
    "const conditions: any[] = [];\n\n  if (filters?.status)",
    "const conditions: any[] = [];\n  if (filters?.companyId) conditions.push(eq(expenses.companyId, filters.companyId));\n\n  if (filters?.status)",
    'db: getExpenses WHERE filter')
edits += n

# listReceivables - add companyId filter
db, n = apply_edit(db,
    "const conditions: any[] = [];\n\n  if (filters?.customerId)",
    "const conditions: any[] = [];\n  if (filters?.companyId) conditions.push(eq(receivables.companyId, filters.companyId));\n\n  if (filters?.customerId)",
    'db: listReceivables WHERE filter')
edits += n

# getSalesForExport - add companyId filter
db, n = apply_edit(db,
    "const conditions: any[] = [eq(sales.status, 'ATIVA')];\n\n  if (filters?.startDate)",
    "const conditions: any[] = [eq(sales.status, 'ATIVA')];\n  if (filters?.companyId) conditions.push(eq(sales.companyId, filters.companyId));\n\n  if (filters?.startDate)",
    'db: getSalesForExport WHERE filter')
edits += n

# For SQL raw queries in analysis functions, add AND s.companyId = ? pattern
# These use whereConditions or whereClause patterns

# Sales analysis - add companyId to whereConditions
# Pattern: "WHERE s.status = 'ATIVA'" -> "WHERE s.status = 'ATIVA' AND s.companyId = ${companyId || 1}"
db, n = apply_edit(db,
    "let whereConditions = `WHERE s.status = 'ATIVA'`;",
    "let whereConditions = `WHERE s.status = 'ATIVA'`;\n    if (companyId) whereConditions += ` AND s.companyId = ${companyId}`;",
    'db: sales analysis whereConditions', True)
edits += n

# Expense analysis - add companyId to whereClause
db, n = apply_edit(db,
    "let whereClause = `WHERE e.status = 'ATIVA'`;",
    "let whereClause = `WHERE e.status = 'ATIVA'`;\n    if (companyId) whereClause += ` AND e.companyId = ${companyId}`;",
    'db: expense analysis whereClause', True)
edits += n

# Dashboard functions - add companyId to SQL raw
# getDashboardMonthlyRevenue
db, n = apply_edit(db,
    "AND MONTH(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = MONTH(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n      AND YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = YEAR(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n      AND s.status = 'ATIVA'",
    "AND MONTH(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = MONTH(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n      AND YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = YEAR(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n      AND s.status = 'ATIVA'\n      ${companyId ? `AND s.companyId = ${companyId}` : ''}",
    'db: getDashboardMonthlyRevenue SQL filter')
edits += n

# getDashboardDailyRevenue
db, n = apply_edit(db,
    "AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = DATE(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n      AND s.status = 'ATIVA'",
    "AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = DATE(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n      AND s.status = 'ATIVA'\n      ${companyId ? `AND s.companyId = ${companyId}` : ''}",
    'db: getDashboardDailyRevenue SQL filter')
edits += n

# getDashboardMonthlyPurchases
db, n = apply_edit(db,
    "AND MONTH(CONVERT_TZ(po.issueDate, '+00:00', '-03:00')) = MONTH(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n      AND YEAR(CONVERT_TZ(po.issueDate, '+00:00', '-03:00')) = YEAR(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n      AND po.status = 'CONFIRMADA'",
    "AND MONTH(CONVERT_TZ(po.issueDate, '+00:00', '-03:00')) = MONTH(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n      AND YEAR(CONVERT_TZ(po.issueDate, '+00:00', '-03:00')) = YEAR(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n      AND po.status = 'CONFIRMADA'\n      ${companyId ? `AND po.companyId = ${companyId}` : ''}",
    'db: getDashboardMonthlyPurchases SQL filter')
edits += n

# getSalesCalendar - add companyId filter
db, n = apply_edit(db,
    "WHERE s.status = 'ATIVA'\n      AND YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = ?\n      AND MONTH(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = ?",
    "WHERE s.status = 'ATIVA'\n      AND YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = ?\n      AND MONTH(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = ?\n      ${companyId ? `AND s.companyId = ${companyId}` : ''}",
    'db: getSalesCalendar SQL filter')
edits += n

# getPayablesCalendar - add companyId filter
db, n = apply_edit(db,
    "WHERE pi.status = 'PENDENTE'\n        AND YEAR(pi.dueDate) = ?\n        AND MONTH(pi.dueDate) = ?",
    "WHERE pi.status = 'PENDENTE'\n        AND YEAR(pi.dueDate) = ?\n        AND MONTH(pi.dueDate) = ?\n        ${companyId ? `AND po.companyId = ${companyId}` : ''}",
    'db: getPayablesCalendar purchase SQL filter')
edits += n

# getMonthlyClosing - add companyId to internal SQL queries
# Revenue query
db, n = apply_edit(db,
    "WHERE s.status = 'ATIVA'\n      AND CONVERT_TZ(s.saleDate, '+00:00', '-03:00') >= ?\n      AND CONVERT_TZ(s.saleDate, '+00:00', '-03:00') < ?",
    "WHERE s.status = 'ATIVA'\n      AND CONVERT_TZ(s.saleDate, '+00:00', '-03:00') >= ?\n      AND CONVERT_TZ(s.saleDate, '+00:00', '-03:00') < ?\n      ${companyId ? `AND s.companyId = ${companyId}` : ''}",
    'db: getMonthlyClosing revenue SQL filter', True)
edits += n

# Purchase query in monthly closing
db, n = apply_edit(db,
    "WHERE po.status = 'CONFIRMADA'\n      AND CONVERT_TZ(po.issueDate, '+00:00', '-03:00') >= ?\n      AND CONVERT_TZ(po.issueDate, '+00:00', '-03:00') < ?",
    "WHERE po.status = 'CONFIRMADA'\n      AND CONVERT_TZ(po.issueDate, '+00:00', '-03:00') >= ?\n      AND CONVERT_TZ(po.issueDate, '+00:00', '-03:00') < ?\n      ${companyId ? `AND po.companyId = ${companyId}` : ''}",
    'db: getMonthlyClosing purchase SQL filter', True)
edits += n

# Expense query in monthly closing
db, n = apply_edit(db,
    "WHERE e.status = 'ATIVA'\n      AND CONVERT_TZ(e.competenceDate, '+00:00', '-03:00') >= ?\n      AND CONVERT_TZ(e.competenceDate, '+00:00', '-03:00') < ?",
    "WHERE e.status = 'ATIVA'\n      AND CONVERT_TZ(e.competenceDate, '+00:00', '-03:00') >= ?\n      AND CONVERT_TZ(e.competenceDate, '+00:00', '-03:00') < ?\n      ${companyId ? `AND e.companyId = ${companyId}` : ''}",
    'db: getMonthlyClosing expense SQL filter', True)
edits += n

# Cost query in monthly closing (COGS)
db, n = apply_edit(db,
    "WHERE s.status = 'ATIVA'\n        AND CONVERT_TZ(s.saleDate, '+00:00', '-03:00') >= ?\n        AND CONVERT_TZ(s.saleDate, '+00:00', '-03:00') < ?",
    "WHERE s.status = 'ATIVA'\n        AND CONVERT_TZ(s.saleDate, '+00:00', '-03:00') >= ?\n        AND CONVERT_TZ(s.saleDate, '+00:00', '-03:00') < ?\n        ${companyId ? `AND s.companyId = ${companyId}` : ''}",
    'db: getMonthlyClosing cost SQL filter', True)
edits += n

# getYearlyClosing - pass companyId to getMonthlyClosing
db, n = apply_edit(db,
    "const data = await getMonthlyClosing(year, month);",
    "const data = await getMonthlyClosing(year, month, companyId);",
    'db: getYearlyClosing pass companyId')
edits += n

# closingQueries calls inside getMonthlyClosing
db, n = apply_edit(db,
    "      getSalesByCategory(startDate, endDate),\n      getPurchasesByCategory(startDate, endDate),\n      getSalesByPaymentType(startDate, endDate),\n      getStockByCategory(startDate, endDate, year, month),\n      getPurchasesBySupplier(startDate, endDate),\n      getSalesByChannel(startDate, endDate),",
    "      getSalesByCategory(startDate, endDate, companyId),\n      getPurchasesByCategory(startDate, endDate, companyId),\n      getSalesByPaymentType(startDate, endDate, companyId),\n      getStockByCategory(startDate, endDate, year, month, companyId),\n      getPurchasesBySupplier(startDate, endDate, companyId),\n      getSalesByChannel(startDate, endDate, companyId),",
    'db: getMonthlyClosing closingQueries calls')
edits += n

db, n = apply_edit(db,
    "goalsProgress = await getRevenueGoalProgress(year, month);",
    "goalsProgress = await getRevenueGoalProgress(year, month, companyId);",
    'db: getMonthlyClosing goalsProgress')
edits += n

db, n = apply_edit(db,
    "previousMonthData = await getMonthlyClosing(prevYear, prevMonth, true);",
    "previousMonthData = await getMonthlyClosing(prevYear, prevMonth, companyId, true);",
    'db: getMonthlyClosing previousMonth')
edits += n

db, n = apply_edit(db,
    "previousMonthData.salesByCategory = await getSalesByCategory(prevStartDate, prevEndDate);",
    "previousMonthData.salesByCategory = await getSalesByCategory(prevStartDate, prevEndDate, companyId);",
    'db: getMonthlyClosing prevSalesByCategory')
edits += n

# getPurchaseTotalCurrentMonth - SQL raw
db, n = apply_edit(db,
    "WHERE po.status = 'CONFIRMADA'\n      AND MONTH(CONVERT_TZ(po.issueDate, '+00:00', '-03:00')) = MONTH(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n      AND YEAR(CONVERT_TZ(po.issueDate, '+00:00', '-03:00')) = YEAR(CONVERT_TZ(NOW(), '+00:00', '-03:00'))",
    "WHERE po.status = 'CONFIRMADA'\n      AND MONTH(CONVERT_TZ(po.issueDate, '+00:00', '-03:00')) = MONTH(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n      AND YEAR(CONVERT_TZ(po.issueDate, '+00:00', '-03:00')) = YEAR(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n      ${companyId ? `AND po.companyId = ${companyId}` : ''}",
    'db: getPurchaseTotalCurrentMonth SQL filter')
edits += n

# getPurchaseTotalByDocType - SQL raw
db, n = apply_edit(db,
    "WHERE po.status = 'CONFIRMADA'\n      AND MONTH(po.issueDate) = MONTH(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n      AND YEAR(po.issueDate) = YEAR(CONVERT_TZ(NOW(), '+00:00', '-03:00'))",
    "WHERE po.status = 'CONFIRMADA'\n      AND MONTH(po.issueDate) = MONTH(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n      AND YEAR(po.issueDate) = YEAR(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n      ${companyId ? `AND po.companyId = ${companyId}` : ''}",
    'db: getPurchaseTotalByDocType SQL filter')
edits += n

# getGrossMarginByCategory - SQL raw
db, n = apply_edit(db,
    "WHERE s.status = 'ATIVA'\n        AND MONTH(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = MONTH(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n        AND YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = YEAR(CONVERT_TZ(NOW(), '+00:00', '-03:00'))",
    "WHERE s.status = 'ATIVA'\n        AND MONTH(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = MONTH(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n        AND YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = YEAR(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n        ${companyId ? `AND s.companyId = ${companyId}` : ''}",
    'db: getGrossMarginByCategory SQL filter')
edits += n

# getSalesMonthlyStats - SQL raw
db, n = apply_edit(db,
    "WHERE s.status = 'ATIVA'\n      AND YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = ?",
    "WHERE s.status = 'ATIVA'\n      AND YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = ?\n      ${companyId ? `AND s.companyId = ${companyId}` : ''}",
    'db: getSalesMonthlyStats SQL filter')
edits += n

# getDeliveryProductAnalysis - SQL raw
db, n = apply_edit(db,
    "WHERE s.status = 'ATIVA'\n      AND s.saleType = 'DELIVERY'\n      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= ?\n      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= ?",
    "WHERE s.status = 'ATIVA'\n      AND s.saleType = 'DELIVERY'\n      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= ?\n      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= ?\n      ${companyId ? `AND s.companyId = ${companyId}` : ''}",
    'db: getDeliveryProductAnalysis SQL filter')
edits += n

# getDeliveryNetMarginOptimized - SQL raw
db, n = apply_edit(db,
    "WHERE s.status = 'ATIVA'\n        AND s.saleType = 'DELIVERY'\n        AND MONTH(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = MONTH(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n        AND YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = YEAR(CONVERT_TZ(NOW(), '+00:00', '-03:00'))",
    "WHERE s.status = 'ATIVA'\n        AND s.saleType = 'DELIVERY'\n        AND MONTH(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = MONTH(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n        AND YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = YEAR(CONVERT_TZ(NOW(), '+00:00', '-03:00'))\n        ${companyId ? `AND s.companyId = ${companyId}` : ''}",
    'db: getDeliveryNetMarginOptimized SQL filter')
edits += n

write_file('/home/ubuntu/erp-demo/server/db.ts', db)
total_edits += edits
print(f"  db.ts edits: {edits}")

# ============================================================
# PART 4: CLOSINGQUERIES.TS
# ============================================================
print("\n=== PART 4: closingQueries.ts ===")
cq = read_file('/home/ubuntu/erp-demo/server/closingQueries.ts')
edits = 0

closing_functions = [
    ('getSalesByCategory(startDate: string, endDate: string)', 'getSalesByCategory(startDate: string, endDate: string, companyId?: number)'),
    ('getPurchasesByCategory(startDate: string, endDate: string)', 'getPurchasesByCategory(startDate: string, endDate: string, companyId?: number)'),
    ('getSalesByPaymentType(startDate: string, endDate: string)', 'getSalesByPaymentType(startDate: string, endDate: string, companyId?: number)'),
    ('getStockByCategory(startDate: string, endDate: string, year: number, month: number)', 'getStockByCategory(startDate: string, endDate: string, year: number, month: number, companyId?: number)'),
    ('getPurchasesBySupplier(startDate: string, endDate: string)', 'getPurchasesBySupplier(startDate: string, endDate: string, companyId?: number)'),
    ('getSalesByChannel(startDate: string, endDate: string)', 'getSalesByChannel(startDate: string, endDate: string, companyId?: number)'),
]

for old, new in closing_functions:
    cq, n = apply_edit(cq, 'export async function ' + old, 'export async function ' + new, f'cq: {old.split("(")[0]} signature')
    edits += n

# Add companyId filters in SQL raw queries
cq, n = apply_edit(cq,
    "WHERE s.status = 'ATIVA'\n      AND CONVERT_TZ(s.saleDate, '+00:00', '-03:00') >= ?\n      AND CONVERT_TZ(s.saleDate, '+00:00', '-03:00') < ?",
    "WHERE s.status = 'ATIVA'\n      AND CONVERT_TZ(s.saleDate, '+00:00', '-03:00') >= ?\n      AND CONVERT_TZ(s.saleDate, '+00:00', '-03:00') < ?\n      ${companyId ? `AND s.companyId = ${companyId}` : ''}",
    'cq: sales WHERE filter', True)
edits += n

cq, n = apply_edit(cq,
    "WHERE po.status = 'CONFIRMADA'\n      AND CONVERT_TZ(po.issueDate, '+00:00', '-03:00') >= ?\n      AND CONVERT_TZ(po.issueDate, '+00:00', '-03:00') < ?",
    "WHERE po.status = 'CONFIRMADA'\n      AND CONVERT_TZ(po.issueDate, '+00:00', '-03:00') >= ?\n      AND CONVERT_TZ(po.issueDate, '+00:00', '-03:00') < ?\n      ${companyId ? `AND po.companyId = ${companyId}` : ''}",
    'cq: purchases WHERE filter', True)
edits += n

write_file('/home/ubuntu/erp-demo/server/closingQueries.ts', cq)
total_edits += edits
print(f"  closingQueries.ts edits: {edits}")

# ============================================================
# PART 5: ROUTERS.TS - Pass ctx.activeCompanyId to all db calls
# ============================================================
print("\n=== PART 5: routers.ts ===")
rt = read_file('/home/ubuntu/erp-demo/server/routers.ts')
edits = 0

# First, fix all handlers that use ({ input }) without ctx - add ctx
# Find all .query(async ({ input }) and .mutation(async ({ input }) patterns
# and add ctx where the function body uses ctx.activeCompanyId

lines = rt.split('\n')
new_lines = []
for i, line in enumerate(lines):
    # Check if any subsequent line (within 30 lines) uses ctx.activeCompanyId
    needs_ctx = False
    if ('.query(async ({ input })' in line or '.mutation(async ({ input })' in line) and 'ctx' not in line:
        # Look ahead for ctx usage
        for j in range(i+1, min(i+30, len(lines))):
            if 'ctx.activeCompanyId' in lines[j] or 'ctx.activeBranchId' in lines[j] or 'ctx.user' in lines[j]:
                needs_ctx = True
                break
            if '.query(' in lines[j] or '.mutation(' in lines[j] or 'router({' in lines[j]:
                break
        if needs_ctx:
            line = line.replace('.query(async ({ input })', '.query(async ({ input, ctx })')
            line = line.replace('.mutation(async ({ input })', '.mutation(async ({ input, ctx })')
    
    if ('.query(async ()' in line or '.mutation(async ()' in line) and 'ctx' not in line:
        for j in range(i+1, min(i+30, len(lines))):
            if 'ctx.activeCompanyId' in lines[j] or 'ctx.activeBranchId' in lines[j] or 'ctx.user' in lines[j]:
                needs_ctx = True
                break
            if '.query(' in lines[j] or '.mutation(' in lines[j] or 'router({' in lines[j]:
                break
        if needs_ctx:
            line = line.replace('.query(async ()', '.query(async ({ ctx })')
            line = line.replace('.mutation(async ()', '.mutation(async ({ ctx })')
    
    new_lines.append(line)

rt = '\n'.join(new_lines)

# Now apply the specific db.* call replacements
router_edits = [
    # Sales
    ("return await db.getSales(input);", "return await db.getSales({ ...input, companyId: ctx.activeCompanyId });"),
    ("return await db.getSalesStats(\n          input?.period || 'month',\n          input?.dateFrom,\n          input?.dateTo,\n          input?.channel === 'all' ? undefined : input?.channel\n        );",
     "return await db.getSalesStats(\n          input?.period || 'month',\n          input?.dateFrom,\n          input?.dateTo,\n          input?.channel === 'all' ? undefined : input?.channel,\n          ctx.activeCompanyId\n        );"),
    ("return await db.getSalesCalendar(input.year, input.month);", "return await db.getSalesCalendar(input.year, input.month, ctx.activeCompanyId);"),
    ("return await db.getSalesMonthlyStats(input.year);", "return await db.getSalesMonthlyStats(input.year, ctx.activeCompanyId);"),
    ("await db.cancelSale(input.id, ctx.user.id, input.reason);", "await db.cancelSale(input.id, ctx.user.id, input.reason, ctx.activeCompanyId);"),
    ("return await db.getSalesForExport(input);", "return await db.getSalesForExport({ ...input, companyId: ctx.activeCompanyId });"),
    
    # Purchases
    ("return await db.getPurchaseOrders(input);", "return await db.getPurchaseOrders({ ...input, companyId: ctx.activeCompanyId });"),
    ("return await db.searchProducts(input.search);", "return await db.searchProducts(input.search, ctx.activeCompanyId);"),
    
    # Expenses
    ("return await db.getExpenseCategories(input?.activeOnly ?? true);", "return await db.getExpenseCategories(input?.activeOnly ?? true, ctx.activeCompanyId);"),
    ("return await db.getExpenses(input);", "return await db.getExpenses({ ...input, companyId: ctx.activeCompanyId });"),
    
    # Receivables
    ("return await db.getReceivablesSummary();", "return await db.getReceivablesSummary(ctx.activeCompanyId);"),
    ("return await db.getCustomersWithPendingReceivables();", "return await db.getCustomersWithPendingReceivables(ctx.activeCompanyId);"),
    ("const total = await db.getTotalPendingReceivables();", "const total = await db.getTotalPendingReceivables(ctx.activeCompanyId);"),
    ("const totalPendingReceivables = await db.getTotalPendingReceivables();", "const totalPendingReceivables = await db.getTotalPendingReceivables(ctx.activeCompanyId);"),
    ("return await db.getCustomerReceivableDetail(input.customerId);", "return await db.getCustomerReceivableDetail(input.customerId, ctx.activeCompanyId);"),
    ("return await db.registerCustomerPayment(input);", "return await db.registerCustomerPayment({ ...input, companyId: ctx.activeCompanyId });"),
    ("return await db.listPendingReceivableInstallments(input?.customerId);", "return await db.listPendingReceivableInstallments(input?.customerId, ctx.activeCompanyId);"),
    ("return await db.listOverdueReceivableInstallments();", "return await db.listOverdueReceivableInstallments(ctx.activeCompanyId);"),
    ("return await db.listReceivables(input);", "return await db.listReceivables({ ...input, companyId: ctx.activeCompanyId });"),
    
    # Payables
    ("return await db.getSuppliersWithPendingPayables();", "return await db.getSuppliersWithPendingPayables(ctx.activeCompanyId);"),
    ("return await db.getAllSuppliersWithHistory();", "return await db.getAllSuppliersWithHistory(ctx.activeCompanyId);"),
    ("const total = await db.getTotalPendingPayables();", "const total = await db.getTotalPendingPayables(ctx.activeCompanyId);"),
    ("return await db.getSupplierPayableDetail(input.supplierId);", "return await db.getSupplierPayableDetail(input.supplierId, ctx.activeCompanyId);"),
    ("return await db.registerSupplierPayment(input);", "return await db.registerSupplierPayment({ ...input, companyId: ctx.activeCompanyId });"),
    ("return await db.getPaymentHistory(input || {});", "return await db.getPaymentHistory({ ...(input || {}), companyId: ctx.activeCompanyId });"),
    ("return await db.getPayablesCalendar(input.year, input.month);", "return await db.getPayablesCalendar(input.year, input.month, ctx.activeCompanyId);"),
    
    # Customer accounts
    ("return await db.getCustomersWithBalance();", "return await db.getCustomersWithBalance(ctx.activeCompanyId);"),
    ("return await db.getCustomerAccountHistory(input.customerId);", "return await db.getCustomerAccountHistory(input.customerId, ctx.activeCompanyId);"),
    
    # Dashboard
    ("const dailyRevenue = await db.getDashboardDailyRevenue();", "const dailyRevenue = await db.getDashboardDailyRevenue(ctx.activeCompanyId);"),
    ("const monthlyRevenue = await db.getDashboardMonthlyRevenue();", "const monthlyRevenue = await db.getDashboardMonthlyRevenue(ctx.activeCompanyId);"),
    ("const monthlyPurchases = await db.getDashboardMonthlyPurchases();", "const monthlyPurchases = await db.getDashboardMonthlyPurchases(ctx.activeCompanyId);"),
    ("const categories = await db.getCategories();", "const categories = await db.getCategories(true, ctx.activeCompanyId);"),
    ("const channels = await db.getSalesChannels();", "const channels = await db.getSalesChannels(true, ctx.activeCompanyId);"),
    ("const totalCurrentMonth = await db.getPurchaseTotalCurrentMonth();", "const totalCurrentMonth = await db.getPurchaseTotalCurrentMonth(ctx.activeCompanyId);"),
    ("const totalByDocType = await db.getPurchaseTotalByDocType();", "const totalByDocType = await db.getPurchaseTotalByDocType(ctx.activeCompanyId);"),
    ("const margins = await db.getGrossMarginByCategory();", "const margins = await db.getGrossMarginByCategory(ctx.activeCompanyId);"),
    ("return await db.getDeliveryProductAnalysis(startDateStr, endDateStr, input?.categoryId);", "return await db.getDeliveryProductAnalysis(startDateStr, endDateStr, input?.categoryId, ctx.activeCompanyId);"),
    ("return await db.getDeliveryNetMarginOptimized();", "return await db.getDeliveryNetMarginOptimized(ctx.activeCompanyId);"),
    
    # Products in dashboard
    ("const products = await db.getProducts({ activeOnly: false });", "const products = await db.getProducts({ activeOnly: false, companyId: ctx.activeCompanyId });"),
    ("const products = await db.getProducts({ activeOnly: false, includePrices: true });", "const products = await db.getProducts({ activeOnly: false, includePrices: true, companyId: ctx.activeCompanyId });"),
    ("const recentSales = await db.getSales({ limit: 10 });", "const recentSales = await db.getSales({ limit: 10, companyId: ctx.activeCompanyId });"),
    
    # Sales analysis
    ("return await db.getSalesAnalysisSummary(input.startDate, input.endDate, {", "return await db.getSalesAnalysisSummary(input.startDate, input.endDate, ctx.activeCompanyId, {"),
    ("return await db.getSalesAnalysisByValue(input.startDate, input.endDate, {", "return await db.getSalesAnalysisByValue(input.startDate, input.endDate, ctx.activeCompanyId, {"),
    ("return await db.getSalesAnalysisByQuantity(input.startDate, input.endDate, {", "return await db.getSalesAnalysisByQuantity(input.startDate, input.endDate, ctx.activeCompanyId, {"),
    ("return await db.getSalesAnalysisByCategoryValue(input.startDate, input.endDate, {", "return await db.getSalesAnalysisByCategoryValue(input.startDate, input.endDate, ctx.activeCompanyId, {"),
    ("return await db.getSalesAnalysisByDay(input.startDate, input.endDate, {", "return await db.getSalesAnalysisByDay(input.startDate, input.endDate, ctx.activeCompanyId, {"),
    ("return await db.getSalesAnalysisByWeek(input.startDate, input.endDate, {", "return await db.getSalesAnalysisByWeek(input.startDate, input.endDate, ctx.activeCompanyId, {"),
    ("return await db.getSalesAnalysisByMonth(input.startDate, input.endDate, {", "return await db.getSalesAnalysisByMonth(input.startDate, input.endDate, ctx.activeCompanyId, {"),
    ("return await db.getSalesByProductAndDate(input.startDate, input.endDate, {", "return await db.getSalesByProductAndDate(input.startDate, input.endDate, ctx.activeCompanyId, {"),
    ("          db.getSalesAnalysisSummary(input.period1.startDate, input.period1.endDate, filters),", "          db.getSalesAnalysisSummary(input.period1.startDate, input.period1.endDate, ctx.activeCompanyId, filters),"),
    ("          db.getSalesAnalysisSummary(input.period2.startDate, input.period2.endDate, filters),", "          db.getSalesAnalysisSummary(input.period2.startDate, input.period2.endDate, ctx.activeCompanyId, filters),"),
    
    # Expense analysis
    ("return await db.getExpenseAnalysisSummary(", "return await db.getExpenseAnalysisSummary(ctx.activeCompanyId,"),
    ("return await db.getExpenseAnalysisByCategory(", "return await db.getExpenseAnalysisByCategory(ctx.activeCompanyId,"),
    ("return await db.getExpenseAnalysisByMonth(", "return await db.getExpenseAnalysisByMonth(ctx.activeCompanyId,"),
    ("return await db.getExpenseAnalysisByCategoryAndMonth(", "return await db.getExpenseAnalysisByCategoryAndMonth(ctx.activeCompanyId,"),
    ("return await db.getExpenseHierarchicalData(", "return await db.getExpenseHierarchicalData(ctx.activeCompanyId,"),
    ("return await db.getExpenseAnalysisDetail(", "return await db.getExpenseAnalysisDetail(ctx.activeCompanyId,"),
    
    # Monthly closing
    ("return await db.getMonthlyClosing(input.year, input.month);", "return await db.getMonthlyClosing(input.year, input.month, ctx.activeCompanyId);"),
    ("return await db.getYearlyClosing(input.year);", "return await db.getYearlyClosing(input.year, ctx.activeCompanyId);"),
    
    # Revenue goals
    ("return await db.getRevenueGoals(input?.year);", "return await db.getRevenueGoals(input?.year, ctx.activeCompanyId);"),
    ("return await db.getRevenueGoal(input.year, input.month, input.channelId);", "return await db.getRevenueGoal(input.year, input.month, input.channelId, ctx.activeCompanyId);"),
    ("return await db.getRevenueGoalProgress(input.year, input.month);", "return await db.getRevenueGoalProgress(input.year, input.month, ctx.activeCompanyId);"),
    ("return await db.getAllRevenueGoalHistory(input.year);", "return await db.getAllRevenueGoalHistory(input.year, ctx.activeCompanyId);"),
    
    # Management accounts
    ("return await db.listManagementAccounts(input);", "return await db.listManagementAccounts({ ...input, companyId: ctx.activeCompanyId });"),
    ("return await db.listManagementAccountsForSelect();", "return await db.listManagementAccountsForSelect(ctx.activeCompanyId);"),
    ("return await db.listManagementAccountsGrouped();", "return await db.listManagementAccountsGrouped(ctx.activeCompanyId);"),
    
    # Governance - use ctx.activeCompanyId instead of input.companyId
    ("return await db.getGovernanceSettings(input?.companyId || 1);", "return await db.getGovernanceSettings(ctx.activeCompanyId || input?.companyId || 1);"),
    ("return await db.listAccountingPeriods(input?.companyId || 1);", "return await db.listAccountingPeriods(ctx.activeCompanyId || input?.companyId || 1);"),
    ("return await db.getAccountingPeriod(input.companyId || 1, input.competenceMonth);", "return await db.getAccountingPeriod(ctx.activeCompanyId || input.companyId || 1, input.competenceMonth);"),
    
    # Product movements
    ("return await db.getProductMovements(input.productId, {", "return await db.getProductMovements(input.productId, ctx.activeCompanyId, {"),
    
    # Create operations - add companyId/branchId
    ("const purchaseOrderId = await db.createPurchaseOrder(purchaseOrderData);", "const purchaseOrderId = await db.createPurchaseOrder({ ...purchaseOrderData, companyId: ctx.activeCompanyId ?? 1, branchId: ctx.activeBranchId ?? 1 });"),
    
    # getPendingExpenseInstallments
    ("return await db.getPendingExpenseInstallments(", "return await db.getPendingExpenseInstallments({ companyId: ctx.activeCompanyId,"),
]

for old, new in router_edits:
    rt, n = apply_edit(rt, old, new, f'rt: {old[:60]}...', True)
    edits += n

# createSale - add companyId/branchId
rt, n = apply_edit(rt,
    "const id = await db.createSale(\n          { ...saleDataWithoutDueDates, createdBy: ctx.user.id },\n          items\n        );",
    "const id = await db.createSale(\n          { ...saleDataWithoutDueDates, createdBy: ctx.user.id, companyId: ctx.activeCompanyId ?? 1, branchId: ctx.activeBranchId ?? 1 },\n          items\n        );",
    'rt: createSale with companyId')
edits += n

# createReceivable
rt, n = apply_edit(rt,
    "const receivableId = await db.createReceivable({",
    "const receivableId = await db.createReceivable({ companyId: ctx.activeCompanyId ?? 1,",
    'rt: createReceivable with companyId', True)
edits += n

# createExpense
rt, n = apply_edit(rt,
    "const expenseId = await db.createExpense({",
    "const expenseId = await db.createExpense({ companyId: ctx.activeCompanyId ?? 1, branchId: ctx.activeBranchId ?? 1,",
    'rt: createExpense with companyId', True)
edits += n

# registerPaymentToBalance
rt, n = apply_edit(rt,
    "return await db.registerPaymentToBalance({",
    "return await db.registerPaymentToBalance({ companyId: ctx.activeCompanyId,",
    'rt: registerPaymentToBalance with companyId')
edits += n

# registerManualDebit
rt, n = apply_edit(rt,
    "return await db.registerManualDebit({",
    "return await db.registerManualDebit({ companyId: ctx.activeCompanyId,",
    'rt: registerManualDebit with companyId')
edits += n

# upsertRevenueGoal
rt, n = apply_edit(rt,
    "return await db.upsertRevenueGoal({",
    "return await db.upsertRevenueGoal({ companyId: ctx.activeCompanyId ?? 1,",
    'rt: upsertRevenueGoal with companyId')
edits += n

# adjustProductStock
rt, n = apply_edit(rt,
    "return await db.adjustProductStock({",
    "return await db.adjustProductStock({ companyId: ctx.activeCompanyId ?? 1, branchId: ctx.activeBranchId ?? 1,",
    'rt: adjustProductStock with companyId')
edits += n

write_file('/home/ubuntu/erp-demo/server/routers.ts', rt)
total_edits += edits
print(f"  routers.ts edits: {edits}")

print(f"\n=== TOTAL EDITS: {total_edits} ===")
print("Done!")
