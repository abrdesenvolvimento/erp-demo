import { describe, it, expect } from "vitest";

/**
 * Tests for inventory export logic:
 * - Production destination mapping for salon-enabled companies
 * - Conditional inclusion of salon columns
 */

const destinoMap: Record<string, string> = {
  'KITCHEN': 'Cozinha',
  'BAR': 'Bar',
  'BOTH': 'Ambos (Cozinha + Bar)',
  'NONE': 'Nenhum',
};

interface MockProduct {
  id: number;
  name: string;
  ean: string;
  categoryId: number;
  uom: string;
  currentStock: number;
  minStock: number;
  avgCost: string;
  isComposite: boolean;
  active: boolean;
  notes: string;
  productionDestination: string | null;
  availableInSalon: boolean;
  prices: { channelId: number; price: string }[];
}

function buildExportRow(product: MockProduct, isHamburgueria: boolean, isAdmin: boolean) {
  const baseData: Record<string, any> = {
    'ID': product.id,
    'Nome': product.name,
    'EAN': product.ean || '',
    'Unidade': product.uom,
    'Estoque Atual': product.currentStock || 0,
    'Estoque Mínimo': product.minStock || 0,
    'Custo Médio': isAdmin ? parseFloat(product.avgCost || '0').toFixed(2) : '',
    'Tipo': product.isComposite ? 'Composto' : 'Simples',
    'Ativo': product.active ? 'Sim' : 'Não',
  };

  if (isHamburgueria) {
    baseData['Destino Produção'] = destinoMap[product.productionDestination || 'NONE'] || 'Nenhum';
    baseData['Disponível Salão'] = product.availableInSalon ? 'Sim' : 'Não';
  }

  baseData['Observações'] = product.notes || '';

  return baseData;
}

const sampleProduct: MockProduct = {
  id: 1,
  name: 'Smash Burger',
  ean: '7891234567890',
  categoryId: 1,
  uom: 'UN',
  currentStock: 50,
  minStock: 10,
  avgCost: '12.50',
  isComposite: false,
  active: true,
  notes: 'Produto principal',
  productionDestination: 'KITCHEN',
  availableInSalon: true,
  prices: [{ channelId: 1, price: '25.00' }],
};

describe("Inventory Export - Production Destination", () => {
  it("should include 'Destino Produção' column for hamburgueria companies", () => {
    const row = buildExportRow(sampleProduct, true, true);
    expect(row).toHaveProperty('Destino Produção');
    expect(row['Destino Produção']).toBe('Cozinha');
  });

  it("should include 'Disponível Salão' column for hamburgueria companies", () => {
    const row = buildExportRow(sampleProduct, true, true);
    expect(row).toHaveProperty('Disponível Salão');
    expect(row['Disponível Salão']).toBe('Sim');
  });

  it("should NOT include salon columns for non-hamburgueria companies", () => {
    const row = buildExportRow(sampleProduct, false, true);
    expect(row).not.toHaveProperty('Destino Produção');
    expect(row).not.toHaveProperty('Disponível Salão');
  });

  it("should map KITCHEN to 'Cozinha'", () => {
    const product = { ...sampleProduct, productionDestination: 'KITCHEN' };
    const row = buildExportRow(product, true, true);
    expect(row['Destino Produção']).toBe('Cozinha');
  });

  it("should map BAR to 'Bar'", () => {
    const product = { ...sampleProduct, productionDestination: 'BAR' };
    const row = buildExportRow(product, true, true);
    expect(row['Destino Produção']).toBe('Bar');
  });

  it("should map BOTH to 'Ambos (Cozinha + Bar)'", () => {
    const product = { ...sampleProduct, productionDestination: 'BOTH' };
    const row = buildExportRow(product, true, true);
    expect(row['Destino Produção']).toBe('Ambos (Cozinha + Bar)');
  });

  it("should map NONE to 'Nenhum'", () => {
    const product = { ...sampleProduct, productionDestination: 'NONE' };
    const row = buildExportRow(product, true, true);
    expect(row['Destino Produção']).toBe('Nenhum');
  });

  it("should handle null productionDestination as 'Nenhum'", () => {
    const product = { ...sampleProduct, productionDestination: null };
    const row = buildExportRow(product, true, true);
    expect(row['Destino Produção']).toBe('Nenhum');
  });

  it("should show 'Não' for availableInSalon=false", () => {
    const product = { ...sampleProduct, availableInSalon: false };
    const row = buildExportRow(product, true, true);
    expect(row['Disponível Salão']).toBe('Não');
  });

  it("should hide cost for non-admin users", () => {
    const row = buildExportRow(sampleProduct, true, false);
    expect(row['Custo Médio']).toBe('');
  });

  it("should always place 'Observações' as the last column", () => {
    const rowHamb = buildExportRow(sampleProduct, true, true);
    const rowNormal = buildExportRow(sampleProduct, false, true);
    
    const keysHamb = Object.keys(rowHamb);
    const keysNormal = Object.keys(rowNormal);
    
    expect(keysHamb[keysHamb.length - 1]).toBe('Observações');
    expect(keysNormal[keysNormal.length - 1]).toBe('Observações');
  });
});
