#!/bin/bash
cd /home/ubuntu/erp-demo

# Substituir todas as referências de receivables para payables
sed -i 's/receivables/payables/g' client/src/pages/ContasPagar.tsx
sed -i 's/Receivables/Payables/g' client/src/pages/ContasPagar.tsx

# Substituir customer para supplier
sed -i 's/customer/supplier/g' client/src/pages/ContasPagar.tsx
sed -i 's/Customer/Supplier/g' client/src/pages/ContasPagar.tsx
sed -i 's/CUSTOMER/SUPPLIER/g' client/src/pages/ContasPagar.tsx

# Substituir sale para expense
sed -i 's/sale/expense/g' client/src/pages/ContasPagar.tsx
sed -i 's/Sale/Expense/g' client/src/pages/ContasPagar.tsx

# Substituir textos específicos
sed -i 's/Contas a Receber/Contas a Pagar/g' client/src/pages/ContasPagar.tsx
sed -i 's/Contas Receber/Contas Pagar/g' client/src/pages/ContasPagar.tsx
sed -i 's/ContasReceber/ContasPagar/g' client/src/pages/ContasPagar.tsx
sed -i 's/recebimento/pagamento/g' client/src/pages/ContasPagar.tsx
sed -i 's/Recebimento/Pagamento/g' client/src/pages/ContasPagar.tsx
sed -i 's/recebimentos/pagamentos/g' client/src/pages/ContasPagar.tsx
sed -i 's/Recebimentos/Pagamentos/g' client/src/pages/ContasPagar.tsx
sed -i 's/Recebido/Pago/g' client/src/pages/ContasPagar.tsx
sed -i 's/recebido/pago/g' client/src/pages/ContasPagar.tsx
sed -i 's/Limite de Crédito/Limite de Compra/g' client/src/pages/ContasPagar.tsx
sed -i 's/Saldo Devedor/Saldo a Pagar/g' client/src/pages/ContasPagar.tsx
sed -i 's/Vendas A Prazo/Compras A Prazo/g' client/src/pages/ContasPagar.tsx
sed -i 's/Histórico de compras do supplier/Histórico de compras do fornecedor/g' client/src/pages/ContasPagar.tsx
sed -i 's/Registrar Recebimento/Registrar Pagamento/g' client/src/pages/ContasPagar.tsx
sed -i 's/Histórico de Recebimentos/Histórico de Pagamentos/g' client/src/pages/ContasPagar.tsx
sed -i 's/Pagamentos realizados pelo supplier/Pagamentos realizados ao fornecedor/g' client/src/pages/ContasPagar.tsx
sed -i 's/Nenhum recebimento registrado ainda/Nenhum pagamento registrado ainda/g' client/src/pages/ContasPagar.tsx
sed -i 's/Registro de Recebimento/Registro de Pagamento/g' client/src/pages/ContasPagar.tsx
sed -i 's/Registre um novo recebimento/Registre um novo pagamento/g' client/src/pages/ContasPagar.tsx
sed -i 's/Data Recebimento/Data Pagamento/g' client/src/pages/ContasPagar.tsx
sed -i 's/Valor Recebido/Valor Pago/g' client/src/pages/ContasPagar.tsx

echo "Adaptação concluída!"
