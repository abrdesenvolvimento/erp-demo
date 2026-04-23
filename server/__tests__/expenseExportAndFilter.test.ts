import { describe, it, expect } from "vitest";

/**
 * Tests for expense export totals and analysis category filter logic.
 */

// Simulate the backend getExpenses totalActiveAmount / totalCancelledAmount calculation
function calculateExpenseTotals(expenses: Array<{ amount: string; status: string }>) {
  const totalActiveAmount = expenses
    .filter(e => e.status === 'ATIVA')
    .reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);
  const totalCancelledAmount = expenses
    .filter(e => e.status === 'CANCELADA')
    .reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);
  return { totalActiveAmount, totalCancelledAmount };
}

// Simulate pagination logic
function paginateExpenses(
  expenses: Array<{ amount: string; status: string }>,
  page: number,
  limit: number
) {
  const total = expenses.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginatedData = expenses.slice(offset, offset + limit);
  
  // Totals are calculated from ALL data, not just the page
  const { totalActiveAmount, totalCancelledAmount } = calculateExpenseTotals(expenses);
  
  return { data: paginatedData, total, totalPages, page, totalActiveAmount, totalCancelledAmount };
}

describe("Expense Export - Total Calculation", () => {
  const allExpenses = [
    { amount: "100.00", status: "ATIVA" },
    { amount: "200.00", status: "ATIVA" },
    { amount: "50.00", status: "CANCELADA" },
    { amount: "300.00", status: "ATIVA" },
    { amount: "150.00", status: "ATIVA" },
    { amount: "75.00", status: "CANCELADA" },
  ];

  it("should calculate total amounts from ALL expenses, not just the current page", () => {
    const result = paginateExpenses(allExpenses, 1, 2); // Page 1, 2 per page
    
    // Page has only 2 items
    expect(result.data.length).toBe(2);
    
    // But totals reflect ALL expenses
    expect(result.totalActiveAmount).toBe(750); // 100 + 200 + 300 + 150
    expect(result.totalCancelledAmount).toBe(125); // 50 + 75
    expect(result.total).toBe(6);
  });

  it("should return correct totals for page 2", () => {
    const result = paginateExpenses(allExpenses, 2, 2);
    
    expect(result.data.length).toBe(2);
    // Totals should be the same regardless of page
    expect(result.totalActiveAmount).toBe(750);
    expect(result.totalCancelledAmount).toBe(125);
  });

  it("should return all items when limit is large enough", () => {
    const result = paginateExpenses(allExpenses, 1, 99999);
    
    expect(result.data.length).toBe(6);
    expect(result.totalActiveAmount).toBe(750);
    expect(result.totalCancelledAmount).toBe(125);
    expect(result.totalPages).toBe(1);
  });

  it("should handle empty expenses", () => {
    const result = paginateExpenses([], 1, 30);
    
    expect(result.data.length).toBe(0);
    expect(result.totalActiveAmount).toBe(0);
    expect(result.totalCancelledAmount).toBe(0);
    expect(result.total).toBe(0);
  });
});

// Simulate the category filter logic from AnaliseDespesas
function filterByCategory(
  data: Array<{ categoryId: number; categoryName: string; amount: number }>,
  selectedCategoryIds: number[]
) {
  if (selectedCategoryIds.length === 0) return data;
  return data.filter(item => selectedCategoryIds.includes(item.categoryId));
}

function extractUniqueCategories(data: Array<{ categoryId: number; categoryName: string }>) {
  const catMap = new Map<number, string>();
  data.forEach(item => {
    if (item.categoryId && !catMap.has(item.categoryId)) {
      catMap.set(item.categoryId, item.categoryName || 'N/A');
    }
  });
  return Array.from(catMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

describe("Expense Analysis - Category Filter", () => {
  const sampleData = [
    { categoryId: 1, categoryName: "Aluguel", amount: 5000 },
    { categoryId: 1, categoryName: "Aluguel", amount: 5000 },
    { categoryId: 2, categoryName: "Energia", amount: 800 },
    { categoryId: 2, categoryName: "Energia", amount: 900 },
    { categoryId: 3, categoryName: "Água", amount: 200 },
    { categoryId: 4, categoryName: "Marketing", amount: 1500 },
  ];

  it("should return all data when no category filter is selected", () => {
    const result = filterByCategory(sampleData, []);
    expect(result.length).toBe(6);
  });

  it("should filter by single category", () => {
    const result = filterByCategory(sampleData, [1]);
    expect(result.length).toBe(2);
    expect(result.every(r => r.categoryId === 1)).toBe(true);
  });

  it("should filter by multiple categories", () => {
    const result = filterByCategory(sampleData, [1, 2]);
    expect(result.length).toBe(4);
    expect(result.every(r => [1, 2].includes(r.categoryId))).toBe(true);
  });

  it("should return empty when filtering by non-existent category", () => {
    const result = filterByCategory(sampleData, [999]);
    expect(result.length).toBe(0);
  });

  it("should extract unique categories sorted alphabetically", () => {
    const categories = extractUniqueCategories(sampleData);
    expect(categories.length).toBe(4);
    expect(categories[0].name).toBe("Água");
    expect(categories[1].name).toBe("Aluguel");
    expect(categories[2].name).toBe("Energia");
    expect(categories[3].name).toBe("Marketing");
  });

  it("should handle empty data for category extraction", () => {
    const categories = extractUniqueCategories([]);
    expect(categories.length).toBe(0);
  });
});
