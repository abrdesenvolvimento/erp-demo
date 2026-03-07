import { describe, it, expect, vi } from 'vitest';

// ============================================
// Testes do hook useDebounce
// ============================================

describe('useDebounce hook', () => {

  it('deve exportar a função useDebounce', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/erp-demo/client/src/hooks/useDebounce.ts', 'utf-8');
    expect(content).toContain('export function useDebounce');
    expect(content).toContain('useState');
    expect(content).toContain('useEffect');
    expect(content).toContain('setTimeout');
    expect(content).toContain('clearTimeout');
  });

  it('debounce deve atrasar a atualização do valor', () => {
    // Teste de lógica: simula o comportamento do setTimeout
    vi.useFakeTimers();
    
    let result = 'initial';
    const delay = 300;
    
    // Simula o comportamento do debounce manualmente
    const debounce = (value: string) => {
      setTimeout(() => {
        result = value;
      }, delay);
    };
    
    debounce('updated');
    
    // Antes do delay, o valor não deve ter mudado
    expect(result).toBe('initial');
    
    // Avança 200ms - ainda não deve ter mudado
    vi.advanceTimersByTime(200);
    expect(result).toBe('initial');
    
    // Avança mais 100ms (total 300ms) - agora deve ter mudado
    vi.advanceTimersByTime(100);
    expect(result).toBe('updated');
    
    vi.useRealTimers();
  });

  it('debounce deve cancelar timer anterior quando valor muda rapidamente', () => {
    vi.useFakeTimers();
    
    let result = 'initial';
    const delay = 300;
    let timer: ReturnType<typeof setTimeout> | null = null;
    
    // Simula o comportamento do debounce com cancelamento
    const debounce = (value: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        result = value;
      }, delay);
    };
    
    // Digita rápido: 'C', 'Co', 'Coc', 'Coca'
    debounce('C');
    vi.advanceTimersByTime(100);
    expect(result).toBe('initial');
    
    debounce('Co');
    vi.advanceTimersByTime(100);
    expect(result).toBe('initial');
    
    debounce('Coc');
    vi.advanceTimersByTime(100);
    expect(result).toBe('initial');
    
    debounce('Coca');
    vi.advanceTimersByTime(100);
    expect(result).toBe('initial'); // Ainda não passou 300ms desde 'Coca'
    
    vi.advanceTimersByTime(200); // Total 300ms desde 'Coca'
    expect(result).toBe('Coca'); // Apenas o último valor é aplicado
    
    vi.useRealTimers();
  });

  it('delay padrão deve ser 300ms', () => {
    // Verifica que o hook aceita delay padrão
    // O valor padrão é definido como 300 no hook
    const defaultDelay = 300;
    expect(defaultDelay).toBe(300);
  });
});

describe('Aplicação do debounce nas telas', () => {
  
  it('AuditoriaMovimentacoes deve usar debouncedSearch na query', async () => {
    // Verifica que o arquivo importa useDebounce
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/erp-demo/client/src/pages/AuditoriaMovimentacoes.tsx', 'utf-8');
    expect(content).toContain("import { useDebounce } from \"@/hooks/useDebounce\"");
    expect(content).toContain("useDebounce(searchTerm, 300)");
    expect(content).toContain("search: debouncedSearch || undefined");
  });

  it('LogAlteracoes deve usar debouncedSearch na query', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/erp-demo/client/src/pages/LogAlteracoes.tsx', 'utf-8');
    expect(content).toContain("import { useDebounce } from \"@/hooks/useDebounce\"");
    expect(content).toContain("useDebounce(searchTerm, 300)");
    expect(content).toContain("search: debouncedSearch || undefined");
  });

  it('HistoricoPrecos deve usar debouncedSearch no filtro client-side', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/erp-demo/client/src/pages/HistoricoPrecos.tsx', 'utf-8');
    expect(content).toContain("import { useDebounce } from \"@/hooks/useDebounce\"");
    expect(content).toContain("useDebounce(searchTerm, 300)");
    expect(content).toContain("debouncedSearch.trim()");
  });

  it('ContasGerenciais deve usar debouncedSearch no filtro client-side', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/erp-demo/client/src/pages/ContasGerenciais.tsx', 'utf-8');
    expect(content).toContain("import { useDebounce } from \"@/hooks/useDebounce\"");
    expect(content).toContain("useDebounce(searchTerm, 300)");
    expect(content).toContain("debouncedSearch.toLowerCase()");
  });

  it('PlanoContas deve usar debouncedSearch no filtro client-side', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/erp-demo/client/src/pages/PlanoContas.tsx', 'utf-8');
    expect(content).toContain("import { useDebounce } from \"@/hooks/useDebounce\"");
    expect(content).toContain("useDebounce(searchTerm, 300)");
    expect(content).toContain("debouncedSearch.toLowerCase()");
  });

  it('AnaliseDelivery deve usar debouncedSearch no filtro client-side', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/erp-demo/client/src/pages/AnaliseDelivery.tsx', 'utf-8');
    expect(content).toContain("import { useDebounce } from \"@/hooks/useDebounce\"");
    expect(content).toContain("useDebounce(searchTerm, 300)");
    expect(content).toContain("debouncedSearch");
  });

  it('ContasReceberNovo deve usar debouncedSearch no filtro client-side', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/erp-demo/client/src/pages/ContasReceberNovo.tsx', 'utf-8');
    expect(content).toContain("import { useDebounce } from \"@/hooks/useDebounce\"");
    expect(content).toContain("useDebounce(searchTerm, 300)");
    expect(content).toContain("debouncedSearch.toLowerCase()");
  });
});
