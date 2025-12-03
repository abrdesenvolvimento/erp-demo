-- Script para lançar vendas de Josivan com data 30/11/2025
-- Total: 6 itens = R$ 44,00

-- Primeiro, encontrar o ID do cliente Josivan Oliveira
SET @customer_id = (SELECT id FROM customers WHERE name LIKE '%Josivan%' LIMIT 1);

-- Se não encontrar, usar um ID padrão ou criar o cliente
IF @customer_id IS NULL THEN
  INSERT INTO customers (name, email, phone, address, city, state, zipCode, cpfCnpj, creditLimit, createdAt)
  VALUES ('Josivan Oliveira', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 600.00, NOW());
  SET @customer_id = LAST_INSERT_ID();
END IF;

-- Encontrar IDs dos produtos
SET @doritos_id = (SELECT id FROM products WHERE name LIKE '%Doritos Queijo Nacho 75gr%' LIMIT 1);
SET @heineken_id = (SELECT id FROM products WHERE name LIKE '%Heineken 269ml%' LIMIT 1);
SET @frescca_id = (SELECT id FROM products WHERE name LIKE '%Frescca 510ml%' LIMIT 1);
SET @delvalle_id = (SELECT id FROM products WHERE name LIKE '%Del Valle Kapo Laranja 200ml%' LIMIT 1);

-- Data de lançamento: 30/11/2025 às 10:00 (Brasília)
-- Convertendo para UTC: 30/11/2025 13:00 UTC
SET @sale_date = '2025-11-30 13:00:00';

-- Criar venda #1 (Doritos + Heineken x2 + Frescca + Del Valle x2 + Heineken + Doritos)
-- Venda única com todos os itens

INSERT INTO sales (customerId, saleType, saleDate, createdAt)
VALUES (@customer_id, 'a_prazo', @sale_date, @sale_date);

SET @sale_id = LAST_INSERT_ID();

-- Adicionar itens da venda
INSERT INTO saleItems (saleId, productId, quantity, unitPrice, createdAt) VALUES
  (@sale_id, @doritos_id, 1, 10.00, @sale_date),
  (@sale_id, @heineken_id, 2, 5.00, @sale_date),
  (@sale_id, @frescca_id, 1, 2.00, @sale_date),
  (@sale_id, @delvalle_id, 2, 3.50, @sale_date),
  (@sale_id, @heineken_id, 1, 5.00, @sale_date),
  (@sale_id, @doritos_id, 1, 10.00, @sale_date);

-- Atualizar estoque dos produtos
UPDATE products SET stock = stock - 1 WHERE id = @doritos_id;
UPDATE products SET stock = stock - 3 WHERE id = @heineken_id;
UPDATE products SET stock = stock - 1 WHERE id = @frescca_id;
UPDATE products SET stock = stock - 2 WHERE id = @delvalle_id;

-- Verificar resultado
SELECT @sale_id as 'Venda ID', @customer_id as 'Cliente ID', 
       (SELECT COUNT(*) FROM saleItems WHERE saleId = @sale_id) as 'Total Itens',
       (SELECT SUM(quantity * unitPrice) FROM saleItems WHERE saleId = @sale_id) as 'Total Venda';
