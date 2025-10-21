-- Migration: Refatorar tabela expenses
-- Data: 21/10/2025
-- Objetivo: Adicionar novos campos e ajustar estrutura conforme feedback

-- 1. Adicionar novos campos
ALTER TABLE expenses 
  ADD COLUMN docType ENUM('NOTA_FISCAL', 'CUPOM') NOT NULL DEFAULT 'CUPOM' AFTER supplierId,
  ADD COLUMN docNumber VARCHAR(100) AFTER docType,
  ADD COLUMN amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER description,
  ADD COLUMN paymentMethod VARCHAR(50) NOT NULL DEFAULT 'Boleto' AFTER amount;

-- 2. Copiar dados de totalAmount para amount
UPDATE expenses SET amount = totalAmount;

-- 3. Atualizar status para incluir PAGA
ALTER TABLE expenses 
  MODIFY COLUMN status ENUM('ATIVA', 'PAGA', 'CANCELADA') NOT NULL DEFAULT 'ATIVA';

-- 4. Remover colunas antigas (depois de confirmar que está tudo ok)
-- ALTER TABLE expenses 
--   DROP COLUMN totalAmount,
--   DROP COLUMN paymentType,
--   DROP COLUMN installments,
--   DROP COLUMN dueDay,
--   DROP COLUMN firstDueDate;

-- 5. Atualizar tabela expenseInstallments
ALTER TABLE expenseInstallments
  MODIFY COLUMN paymentMethod VARCHAR(50);

