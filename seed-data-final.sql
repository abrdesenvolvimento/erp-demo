-- ==================== SEED DATA FINAL ====================
-- Data: 21/10/2025
-- Descrição: Dados de teste para o sistema ERP

-- ==================== CANAIS DE VENDA ====================
INSERT INTO salesChannels (code, name, type, active) VALUES
('BALCAO', 'Balcão / A Prazo', 'BALCAO', 1),
('IFOOD', 'iFood', 'DELIVERY', 1),
('99FOOD', '99 Food', 'DELIVERY', 1),
('PROPRIO', 'Delivery Próprio', 'DELIVERY', 1);

-- ==================== CATEGORIAS ====================
INSERT INTO categories (name, active) VALUES
('Bebidas', 1);

-- ==================== PRODUTOS ====================
-- 1. Coca Cola 2l (Simples)
INSERT INTO products (name, categoryId, ean, uom, minStock, currentStock, avgCost, active, isComposite, notes) VALUES
('Coca Cola 2l', 1, '7894900011517', 'UN', 10, 100, 8.35, 1, 0, 'Refrigerante Coca-Cola 2 litros');

-- 2. Heineken 269ml (Simples)
INSERT INTO products (name, categoryId, ean, uom, minStock, currentStock, avgCost, active, isComposite, notes) VALUES
('Heineken 269ml', 1, '8715428002391', 'UN', 50, 100, 3.35, 1, 0, 'Cerveja Heineken long neck 269ml');

-- 3. Heineken 269ml Pack 8 Unidades (Composto)
INSERT INTO products (name, categoryId, ean, uom, minStock, currentStock, avgCost, active, isComposite, notes) VALUES
('Heineken 269ml Pack 8 Un', 1, '8715428002408', 'PACK', 5, 20, 26.80, 1, 1, 'Pack com 8 unidades de Heineken 269ml');

-- ==================== COMPOSIÇÃO DE PRODUTOS ====================
-- Pack de Heineken contém 8 unidades de Heineken 269ml
INSERT INTO productCompositions (parentProductId, childProductId, quantity) VALUES
(3, 2, 8);

-- ==================== PREÇOS POR CANAL ====================
-- Coca Cola 2l
INSERT INTO productPrices (productId, channelId, price, effectiveFrom) VALUES
(1, 1, 13.00, NOW()),  -- Balcão
(1, 2, 11.99, NOW()),  -- iFood
(1, 3, 10.50, NOW()),  -- 99 Food
(1, 4, 15.00, NOW());  -- Delivery Próprio

-- Heineken 269ml
INSERT INTO productPrices (productId, channelId, price, effectiveFrom) VALUES
(2, 1, 5.00, NOW()),   -- Balcão
(2, 2, 4.79, NOW()),   -- iFood
(2, 3, 5.50, NOW()),   -- 99 Food
(2, 4, 8.00, NOW());   -- Delivery Próprio

-- Heineken 269ml Pack 8 Un
INSERT INTO productPrices (productId, channelId, price, effectiveFrom) VALUES
(3, 1, 39.00, NOW()),  -- Balcão
(3, 2, 37.79, NOW()),  -- iFood
(3, 3, 41.50, NOW()),  -- 99 Food
(3, 4, 38.00, NOW());  -- Delivery Próprio

-- ==================== CLIENTE A PRAZO ====================
INSERT INTO partners (partnerType, docNumber, name, phone, email, street, neighborhood, city, state, zipCode, creditLimit, creditPolicy, active, notes) VALUES
('CUSTOMER', '123.456.789-00', 'Gabriel Morais Santos', '(11) 98765-4321', 'gabriel@adegabeirario.com.br', 'Rua das Flores, 123', 'Centro', 'São Paulo', 'SP', '01234-567', 200.00, 'ACTIVE', 1, 'Cliente preferencial com limite de crédito');

-- ==================== VERIFICAÇÃO ====================
SELECT 'Canais de Venda' as tabela, COUNT(*) as registros FROM salesChannels
UNION ALL SELECT 'Categorias', COUNT(*) FROM categories
UNION ALL SELECT 'Produtos', COUNT(*) FROM products
UNION ALL SELECT 'Composições', COUNT(*) FROM productCompositions
UNION ALL SELECT 'Preços', COUNT(*) FROM productPrices
UNION ALL SELECT 'Clientes', COUNT(*) FROM partners;

-- Mostrar produtos com preços
SELECT 
    p.id,
    p.name as produto,
    p.currentStock as estoque,
    p.avgCost as custo,
    sc.name as canal,
    pp.price as preco
FROM products p
JOIN productPrices pp ON p.id = pp.productId
JOIN salesChannels sc ON pp.channelId = sc.id
ORDER BY p.id, sc.id;

