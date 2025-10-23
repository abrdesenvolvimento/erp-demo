/**
 * Utilitário para busca de endereço por CEP usando ViaCEP
 */

export interface CEPData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

/**
 * Busca endereço por CEP na API ViaCEP
 * @param cep CEP com ou sem formatação
 * @returns Dados do endereço ou null se não encontrado
 */
export async function fetchCEP(cep: string): Promise<CEPData | null> {
  try {
    // Remove formatação do CEP
    const cleanCEP = cep.replace(/\D/g, '');
    
    // Valida tamanho
    if (cleanCEP.length !== 8) {
      return null;
    }
    
    // Busca na API
    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
    
    if (!response.ok) {
      return null;
    }
    
    const data: CEPData = await response.json();
    
    // Verifica se houve erro
    if (data.erro) {
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Erro ao buscar CEP:', error);
    return null;
  }
}

/**
 * Formata CEP para exibição
 * @param cep CEP sem formatação
 * @returns CEP formatado (00000-000)
 */
export function formatCEP(cep: string): string {
  const cleaned = cep.replace(/\D/g, '');
  
  if (cleaned.length <= 5) {
    return cleaned;
  }
  
  return cleaned.replace(/(\d{5})(\d{1,3})/, '$1-$2');
}

