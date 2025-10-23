// Formatar tipos de venda
export function formatSaleType(type: string): string {
  const map: Record<string, string> = {
    'BALCAO': 'Balcão',
    'DELIVERY': 'Delivery',
    'A_PRAZO': 'A Prazo'
  };
  return map[type] || type;
}

// Formatar tipos de documento
export function formatDocType(type: string): string {
  const map: Record<string, string> = {
    'NOTA_FISCAL': 'Nota Fiscal',
    'CUPOM': 'Cupom',
    'SEM_DOCUMENTO': 'Sem Documento'
  };
  return map[type] || type;
}

// Formatar formas de pagamento
export function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    'DINHEIRO': 'Dinheiro',
    'PIX': 'PIX',
    'CARTAO_CREDITO': 'Cartão de Crédito',
    'CARTAO_DEBITO': 'Cartão de Débito',
    'BOLETO': 'Boleto',
    'TRANSFERENCIA': 'Transferência Bancária',
    'A_PRAZO': 'A Prazo'
  };
  return map[method] || method;
}

// Formatar status
export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    'PENDING': 'Pendente',
    'PAID': 'Pago',
    'CANCELLED': 'Cancelado',
    'PENDENTE': 'Pendente',
    'PAGO': 'Pago',
    'CANCELADO': 'Cancelado',
    'VENCIDO': 'Vencido',
    'ATIVA': 'Ativa',
    'INATIVA': 'Inativa'
  };
  return map[status] || status;
}

