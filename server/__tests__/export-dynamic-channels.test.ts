import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const PRODUTOS_TSX = fs.readFileSync(path.resolve(__dirname, '../../client/src/pages/Produtos.tsx'), 'utf-8');

describe('v47.7 - Export uses dynamic channel IDs (not hardcoded)', () => {
  it('should NOT have hardcoded channel IDs (1, 2, 3, 4) in the export function', () => {
    // Find the export function
    const exportStart = PRODUTOS_TSX.indexOf('handleExportExcel');
    const exportEnd = PRODUTOS_TSX.indexOf('toast.success(`Exportados', exportStart);
    const exportBody = PRODUTOS_TSX.substring(exportStart, exportEnd);
    
    // Should NOT have hardcoded IDs like BALCAO_APRAZO_ID = 1
    expect(exportBody).not.toContain('BALCAO_APRAZO_ID = 1');
    expect(exportBody).not.toContain('DELIVERY_IFOOD_ID = 2');
    expect(exportBody).not.toContain('DELIVERY_99FOOD_ID = 3');
    expect(exportBody).not.toContain('DELIVERY_PROPRIO_ID = 4');
  });

  it('should use dynamic channels from the channels query', () => {
    const exportStart = PRODUTOS_TSX.indexOf('handleExportExcel');
    const exportEnd = PRODUTOS_TSX.indexOf('toast.success(`Exportados', exportStart);
    const exportBody = PRODUTOS_TSX.substring(exportStart, exportEnd);
    
    // Should use sortedChannels for dynamic iteration
    expect(exportBody).toContain('sortedChannels');
    expect(exportBody).toContain('channels || []');
  });

  it('should iterate over channels to build price columns dynamically', () => {
    const exportStart = PRODUTOS_TSX.indexOf('handleExportExcel');
    const exportEnd = PRODUTOS_TSX.indexOf('toast.success(`Exportados', exportStart);
    const exportBody = PRODUTOS_TSX.substring(exportStart, exportEnd);
    
    // Should iterate over channels
    expect(exportBody).toContain('for (const channel of sortedChannels)');
    // Should use channel.id for price lookup
    expect(exportBody).toContain('p.channelId === channel.id');
    // Should use channel.name for column header
    expect(exportBody).toContain('`Preço ${channel.name}`');
  });

  it('should have dynamic column widths based on number of channels', () => {
    const exportStart = PRODUTOS_TSX.indexOf('handleExportExcel');
    const exportEnd = PRODUTOS_TSX.indexOf('toast.success(`Exportados', exportStart);
    const exportBody = PRODUTOS_TSX.substring(exportStart, exportEnd);
    
    // Should spread dynamic channel widths
    expect(exportBody).toContain('...sortedChannels.map(');
  });
});
