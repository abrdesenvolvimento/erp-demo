import { describe, it, expect } from 'vitest';

/**
 * Testes dos temas dinâmicos do sidebar por empresa.
 * Valida que os temas de cores estão corretamente definidos e
 * que as propriedades necessárias existem para cada empresa.
 */

// Reproduzimos a mesma estrutura do DashboardLayout para testar isoladamente
const COMPANY_THEMES: Record<number, {
  sidebarBg: string;
  sidebarBgGradient: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  activeItemBg: string;
  borderColor: string;
  separatorColor: string;
}> = {
  // Adega Beira Rio — Verde Lúpulo + Dourado Trigo
  1: {
    sidebarBg: '#4a6b2a',
    sidebarBgGradient: 'linear-gradient(180deg, #5a7d35 0%, #3d5a22 100%)',
    textPrimary: '#F2F2F2',
    textMuted: 'rgba(242,242,242,0.65)',
    accent: '#F0B840',
    accentHover: 'rgba(240,184,64,0.15)',
    activeItemBg: 'rgba(240,184,64,0.20)',
    borderColor: 'rgba(240,184,64,0.25)',
    separatorColor: 'rgba(242,242,242,0.15)',
  },
  // A Brasa Reúne — Grafite + Laranja Brasa
  2: {
    sidebarBg: '#2F2F2F',
    sidebarBgGradient: 'linear-gradient(180deg, #3a3a3a 0%, #1f1f1f 100%)',
    textPrimary: '#E5D3B3',
    textMuted: 'rgba(229,211,179,0.60)',
    accent: '#F07A00',
    accentHover: 'rgba(240,122,0,0.15)',
    activeItemBg: 'rgba(240,122,0,0.20)',
    borderColor: 'rgba(240,122,0,0.25)',
    separatorColor: 'rgba(229,211,179,0.15)',
  },
};

const DEFAULT_THEME = {
  sidebarBg: '',
  sidebarBgGradient: '',
  textPrimary: '',
  textMuted: '',
  accent: '',
  accentHover: '',
  activeItemBg: '',
  borderColor: '',
  separatorColor: '',
};

// Helper para converter hex para RGB e calcular luminância relativa
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  return {
    r: parseInt(match[1].substring(0, 2), 16),
    g: parseInt(match[1].substring(2, 4), 16),
    b: parseInt(match[1].substring(4, 6), 16),
  };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Temas Dinâmicos do Sidebar", () => {
  describe("Estrutura dos temas", () => {
    it("deve ter tema definido para Adega Beira Rio (companyId=1)", () => {
      expect(COMPANY_THEMES[1]).toBeDefined();
    });

    it("deve ter tema definido para A Brasa Reúne (companyId=2)", () => {
      expect(COMPANY_THEMES[2]).toBeDefined();
    });

    it("cada tema deve ter todas as propriedades obrigatórias", () => {
      const requiredKeys = [
        'sidebarBg', 'sidebarBgGradient', 'textPrimary', 'textMuted',
        'accent', 'accentHover', 'activeItemBg', 'borderColor', 'separatorColor'
      ];
      for (const [companyId, theme] of Object.entries(COMPANY_THEMES)) {
        for (const key of requiredKeys) {
          expect((theme as any)[key]).toBeDefined();
          expect((theme as any)[key]).not.toBe('');
        }
      }
    });

    it("tema padrão deve ter todas as propriedades vazias", () => {
      for (const value of Object.values(DEFAULT_THEME)) {
        expect(value).toBe('');
      }
    });
  });

  describe("Cores da Adega Beira Rio", () => {
    const theme = COMPANY_THEMES[1];

    it("deve usar verde lúpulo como cor base do sidebar", () => {
      expect(theme.sidebarBg).toBe('#4a6b2a');
      expect(theme.sidebarBgGradient).toContain('#5a7d35');
      expect(theme.sidebarBgGradient).toContain('#3d5a22');
    });

    it("deve usar dourado como cor de destaque", () => {
      expect(theme.accent).toBe('#F0B840');
    });

    it("deve usar texto claro (branco/off-white) para contraste com fundo escuro", () => {
      expect(theme.textPrimary).toBe('#F2F2F2');
    });

    it("deve ter contraste suficiente entre texto primário e fundo (WCAG AA >= 4.5:1)", () => {
      const bgRgb = hexToRgb(theme.sidebarBg);
      const textRgb = hexToRgb(theme.textPrimary);
      expect(bgRgb).not.toBeNull();
      expect(textRgb).not.toBeNull();
      
      const bgLum = relativeLuminance(bgRgb!.r, bgRgb!.g, bgRgb!.b);
      const textLum = relativeLuminance(textRgb!.r, textRgb!.g, textRgb!.b);
      const ratio = contrastRatio(bgLum, textLum);
      
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("deve ter contraste suficiente entre accent e fundo (WCAG AA >= 3:1 para large text)", () => {
      const bgRgb = hexToRgb(theme.sidebarBg);
      const accentRgb = hexToRgb(theme.accent);
      expect(bgRgb).not.toBeNull();
      expect(accentRgb).not.toBeNull();
      
      const bgLum = relativeLuminance(bgRgb!.r, bgRgb!.g, bgRgb!.b);
      const accentLum = relativeLuminance(accentRgb!.r, accentRgb!.g, accentRgb!.b);
      const ratio = contrastRatio(bgLum, accentLum);
      
      expect(ratio).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Cores da A Brasa Reúne", () => {
    const theme = COMPANY_THEMES[2];

    it("deve usar grafite como cor base do sidebar", () => {
      expect(theme.sidebarBg).toBe('#2F2F2F');
      expect(theme.sidebarBgGradient).toContain('#3a3a3a');
      expect(theme.sidebarBgGradient).toContain('#1f1f1f');
    });

    it("deve usar laranja brasa como cor de destaque", () => {
      expect(theme.accent).toBe('#F07A00');
    });

    it("deve usar creme vintage como texto para contraste com fundo escuro", () => {
      expect(theme.textPrimary).toBe('#E5D3B3');
    });

    it("deve ter contraste suficiente entre texto primário e fundo (WCAG AA >= 4.5:1)", () => {
      const bgRgb = hexToRgb(theme.sidebarBg);
      const textRgb = hexToRgb(theme.textPrimary);
      expect(bgRgb).not.toBeNull();
      expect(textRgb).not.toBeNull();
      
      const bgLum = relativeLuminance(bgRgb!.r, bgRgb!.g, bgRgb!.b);
      const textLum = relativeLuminance(textRgb!.r, textRgb!.g, textRgb!.b);
      const ratio = contrastRatio(bgLum, textLum);
      
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("deve ter contraste suficiente entre accent e fundo (WCAG AA >= 3:1 para large text)", () => {
      const bgRgb = hexToRgb(theme.sidebarBg);
      const accentRgb = hexToRgb(theme.accent);
      expect(bgRgb).not.toBeNull();
      expect(accentRgb).not.toBeNull();
      
      const bgLum = relativeLuminance(bgRgb!.r, bgRgb!.g, bgRgb!.b);
      const accentLum = relativeLuminance(accentRgb!.r, accentRgb!.g, accentRgb!.b);
      const ratio = contrastRatio(bgLum, accentLum);
      
      expect(ratio).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Seleção de tema", () => {
    it("deve retornar tema da Adega para companyId=1", () => {
      const activeCompanyId = 1;
      const theme = activeCompanyId ? (COMPANY_THEMES[activeCompanyId] || DEFAULT_THEME) : DEFAULT_THEME;
      expect(theme.sidebarBg).toBe('#4a6b2a');
      expect(theme.accent).toBe('#F0B840');
    });

    it("deve retornar tema da A Brasa para companyId=2", () => {
      const activeCompanyId = 2;
      const theme = activeCompanyId ? (COMPANY_THEMES[activeCompanyId] || DEFAULT_THEME) : DEFAULT_THEME;
      expect(theme.sidebarBg).toBe('#2F2F2F');
      expect(theme.accent).toBe('#F07A00');
    });

    it("deve retornar tema padrão para companyId desconhecido", () => {
      const activeCompanyId = 999;
      const theme = activeCompanyId ? (COMPANY_THEMES[activeCompanyId] || DEFAULT_THEME) : DEFAULT_THEME;
      expect(theme.sidebarBg).toBe('');
    });

    it("deve retornar tema padrão quando nenhuma empresa está selecionada", () => {
      const activeCompanyId = null;
      const theme = activeCompanyId ? (COMPANY_THEMES[activeCompanyId] || DEFAULT_THEME) : DEFAULT_THEME;
      expect(theme.sidebarBg).toBe('');
    });

    it("hasCustomTheme deve ser true quando empresa tem tema definido", () => {
      const activeCompanyId = 1;
      const theme = activeCompanyId ? (COMPANY_THEMES[activeCompanyId] || DEFAULT_THEME) : DEFAULT_THEME;
      const hasCustomTheme = !!theme.sidebarBg;
      expect(hasCustomTheme).toBe(true);
    });

    it("hasCustomTheme deve ser false quando nenhuma empresa está selecionada", () => {
      const activeCompanyId = null;
      const theme = activeCompanyId ? (COMPANY_THEMES[activeCompanyId] || DEFAULT_THEME) : DEFAULT_THEME;
      const hasCustomTheme = !!theme.sidebarBg;
      expect(hasCustomTheme).toBe(false);
    });
  });

  describe("Temas são distintos entre empresas", () => {
    it("cores de fundo devem ser diferentes entre Adega e A Brasa", () => {
      expect(COMPANY_THEMES[1].sidebarBg).not.toBe(COMPANY_THEMES[2].sidebarBg);
    });

    it("cores de destaque devem ser diferentes entre Adega e A Brasa", () => {
      expect(COMPANY_THEMES[1].accent).not.toBe(COMPANY_THEMES[2].accent);
    });

    it("cores de texto primário devem ser diferentes entre Adega e A Brasa", () => {
      expect(COMPANY_THEMES[1].textPrimary).not.toBe(COMPANY_THEMES[2].textPrimary);
    });
  });
});
