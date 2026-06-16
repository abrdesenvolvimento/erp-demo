import { describe, it, expect } from 'vitest';
import { generateCategoryStory } from './storyGenerator';

describe('storyGenerator', () => {
  it('generates a PNG buffer for a category with items', async () => {
    const category = {
      name: 'BURGERS',
      displayName: 'Burgers',
      sectionStyle: 'light',
      items: [
        { id: 1, name: 'CHEESE BURGER', price: 32.00, description: null },
        { id: 2, name: 'BACON BURGER', price: 38.00, description: 'Com bacon artesanal' },
        { id: 3, name: 'SMASH BURGER', price: 35.00, description: null },
      ],
    };

    const buffer = await generateCategoryStory(category);
    
    // Should return a valid PNG buffer
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    
    // PNG magic bytes
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50); // P
    expect(buffer[2]).toBe(0x4E); // N
    expect(buffer[3]).toBe(0x47); // G
  });

  it('generates a dark-themed story for dark sections', async () => {
    const category = {
      name: 'PARA COMPARTILHAR',
      displayName: 'Para Compartilhar',
      sectionStyle: 'dark',
      items: [
        { id: 1, name: 'BATATA FRITA', price: 25.00, description: null },
        { id: 2, name: 'ONION RINGS', price: 28.00, description: null },
      ],
    };

    const buffer = await generateCategoryStory(category);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    // PNG magic bytes
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
  });

  it('handles categories with many items (truncates at 18)', async () => {
    const items = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `ITEM ${i + 1}`,
      price: 10 + i,
      description: null,
    }));

    const category = {
      name: 'BEBIDAS',
      displayName: 'Bebidas',
      sectionStyle: 'light',
      items,
    };

    const buffer = await generateCategoryStory(category);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('handles items with null prices', async () => {
    const category = {
      name: 'ESPECIAIS',
      displayName: 'Especiais',
      sectionStyle: 'light',
      items: [
        { id: 1, name: 'ITEM SEM PRECO', price: null, description: 'Consulte' },
        { id: 2, name: 'ITEM COM PRECO', price: 45.00, description: null },
      ],
    };

    const buffer = await generateCategoryStory(category);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('handles items with very long names (truncation)', async () => {
    const category = {
      name: 'BURGERS',
      displayName: 'Burgers',
      sectionStyle: 'light',
      items: [
        { id: 1, name: 'SUPER MEGA ULTRA BURGER ESPECIAL DA CASA COM QUEIJO CHEDDAR E BACON ARTESANAL', price: 55.00, description: null },
      ],
    };

    const buffer = await generateCategoryStory(category);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
