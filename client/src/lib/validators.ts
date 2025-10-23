/**
 * Utilitários de validação e formatação
 */

/**
 * Formata CPF ou CNPJ
 */
export function formatCPFCNPJ(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  
  if (cleaned.length <= 11) {
    // CPF: 000.000.000-00
    return cleaned
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    // CNPJ: 00.000.000/0000-00
    return cleaned
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
}

/**
 * Valida CPF
 */
function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  
  if (cleaned.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Valida primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(9))) return false;
  
  // Valida segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
}

/**
 * Valida CNPJ
 */
function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  
  if (cleaned.length !== 14) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cleaned)) return false;
  
  // Valida primeiro dígito verificador
  let sum = 0;
  let weight = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== parseInt(cleaned.charAt(12))) return false;
  
  // Valida segundo dígito verificador
  sum = 0;
  weight = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== parseInt(cleaned.charAt(13))) return false;
  
  return true;
}

/**
 * Valida CPF ou CNPJ
 */
export function validateCPFCNPJ(value: string): boolean {
  if (!value) return true; // Campo opcional
  
  const cleaned = value.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    return validateCPF(cleaned);
  } else if (cleaned.length === 14) {
    return validateCNPJ(cleaned);
  }
  
  return false;
}

/**
 * Valida EAN (código de barras)
 * Suporta EAN-8, EAN-13 e EAN-14
 */
export function validateEAN(ean: string): boolean {
  if (!ean) return true; // Campo opcional
  
  const cleaned = ean.replace(/\D/g, '');
  
  // Deve ter 8, 13 ou 14 dígitos
  if (![8, 13, 14].includes(cleaned.length)) {
    return false;
  }
  
  // Calcula dígito verificador
  let sum = 0;
  for (let i = 0; i < cleaned.length - 1; i++) {
    const digit = parseInt(cleaned.charAt(i));
    // Alterna entre multiplicar por 1 e 3
    const multiplier = (cleaned.length - i) % 2 === 0 ? 3 : 1;
    sum += digit * multiplier;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  const lastDigit = parseInt(cleaned.charAt(cleaned.length - 1));
  
  return checkDigit === lastDigit;
}

/**
 * Formata EAN com espaços para melhor legibilidade
 */
export function formatEAN(ean: string): string {
  const cleaned = ean.replace(/\D/g, '');
  
  if (cleaned.length === 8) {
    // EAN-8: 0000 0000
    return cleaned.replace(/(\d{4})(\d{4})/, '$1 $2');
  } else if (cleaned.length === 13) {
    // EAN-13: 000 0000 000000
    return cleaned.replace(/(\d{3})(\d{4})(\d{6})/, '$1 $2 $3');
  } else if (cleaned.length === 14) {
    // EAN-14: 0 000 0000 000000
    return cleaned.replace(/(\d{1})(\d{3})(\d{4})(\d{6})/, '$1 $2 $3 $4');
  }
  
  return cleaned;
}

