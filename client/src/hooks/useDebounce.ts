import { useState, useEffect } from 'react';

/**
 * Hook que aplica debounce a um valor, retornando o valor atualizado
 * somente após o delay especificado sem novas alterações.
 * 
 * Útil para filtros de busca que disparam queries no backend,
 * evitando requisições excessivas a cada tecla digitada.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
