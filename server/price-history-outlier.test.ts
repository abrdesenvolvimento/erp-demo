import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Price History Outlier Treatment', () => {
  const dbFilePath = path.resolve(__dirname, 'db.ts');
  const dbContent = fs.readFileSync(dbFilePath, 'utf-8');

  it('should define OUTLIER_THRESHOLD constant in getPriceHistoryStats', () => {
    expect(dbContent).toContain('OUTLIER_THRESHOLD = 200');
  });

  it('should exclude outliers from avgIncrease calculation using OUTLIER_THRESHOLD', () => {
    // The SQL should filter out values > OUTLIER_THRESHOLD for increases
    expect(dbContent).toContain('CAST(changePercent AS DECIMAL(10,2)) <= ${OUTLIER_THRESHOLD}');
  });

  it('should exclude outliers from avgDecrease calculation using negative OUTLIER_THRESHOLD', () => {
    // The SQL should filter out values < -OUTLIER_THRESHOLD for decreases
    expect(dbContent).toContain('CAST(changePercent AS DECIMAL(10,2)) >= ${-OUTLIER_THRESHOLD}');
  });

  it('should count outliers per segment', () => {
    expect(dbContent).toContain('outlierCount');
    expect(dbContent).toContain('ABS(CAST(changePercent AS DECIMAL(10,2))) > ${OUTLIER_THRESHOLD}');
  });

  it('should return outlierCount and outlierThreshold in the response', () => {
    expect(dbContent).toContain('outlierCount: totalOutliers');
    expect(dbContent).toContain('outlierThreshold: OUTLIER_THRESHOLD');
  });

  it('should return per-segment outlierCount for venda and custo', () => {
    // Check that venda and custo segments include outlierCount
    expect(dbContent).toContain("outlierCount: Number(vendaStats?.outlierCount || 0)");
    expect(dbContent).toContain("outlierCount: Number(custoStats?.outlierCount || 0)");
  });
});

describe('iFood Price Update Deduplication', () => {
  const ifoodFilePath = path.resolve(__dirname, 'routers/ifoodImport.ts');
  const ifoodContent = fs.readFileSync(ifoodFilePath, 'utf-8');

  it('should check if price is already the same before updating', () => {
    expect(ifoodContent).toContain('parseFloat(oldPrice) === parseFloat(newPriceStr)');
  });

  it('should return skipped: true when price is already updated', () => {
    expect(ifoodContent).toContain("return { success: true, skipped: true, message: 'Preço já está atualizado' }");
  });

  it('should return skipped: false when price was actually changed', () => {
    expect(ifoodContent).toContain('return { success: true, skipped: false }');
  });

  it('should only log price change when price actually differs', () => {
    // The logPriceChange should be AFTER the early return for same price
    const skipIndex = ifoodContent.indexOf('skipped: true');
    const logIndex = ifoodContent.indexOf('logPriceChange', skipIndex);
    expect(logIndex).toBeGreaterThan(skipIndex);
  });
});

describe('Price History Frontend Outlier Indicators', () => {
  const histFilePath = path.resolve(__dirname, '../client/src/pages/HistoricoPrecos.tsx');
  const histContent = fs.readFileSync(histFilePath, 'utf-8');

  it('should show outlier badge with amber color for variations > 200%', () => {
    expect(histContent).toContain('absNum > 200');
    expect(histContent).toContain('bg-amber-100 text-amber-800');
  });

  it('should display outlier count in venda card when present', () => {
    expect(histContent).toContain("venda?.outlierCount");
  });

  it('should display outlier count in custo card when present', () => {
    expect(histContent).toContain("custo?.outlierCount");
  });

  it('should show total outlier count in summary section', () => {
    expect(histContent).toContain("outlierCount");
    expect(histContent).toContain("excluído(s) das médias");
  });
});
