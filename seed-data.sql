-- Seed data for ERP Demo

-- Insert Sales Channels
INSERT INTO salesChannels (code, name, type, active) VALUES
('BALCAO', 'Balcão / A Prazo', 'BALCAO', 1),
('DELIVERY', 'Delivery', 'DELIVERY', 1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Get channel IDs
SET @balcao_id = (SELECT id FROM salesChannels WHERE code = 'BALCAO' LIMIT 1);
SET @delivery_id = (SELECT id FROM salesChannels WHERE code = 'DELIVERY' LIMIT 1);

-- Insert Categories
INSERT INTO categories (name, active) VALUES
('Bebidas', 1),
('Alimentos', 1),
('Higiene', 1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Get category IDs
SET @bebidas_id = (SELECT id FROM categories WHERE name = 'Bebidas' LIMIT 1);
SET @alimentos_id = (SELECT id FROM categories WHERE name = 'Alimentos' LIMIT 1);

-- Insert Products
INSERT INTO products (name, categoryId, ean, uom, minStock, currentStock, avgCost, active, isComposite) VALUES
('Coca Cola 2l', @bebidas_id, '7894900011517', 'UN', 5, 10, '6.50', 1, 0),
('Guaraná Antarctica 2l', @bebidas_id, '7894900011524', 'UN', 5, 15, '5.80', 1, 0),
('Cerveja Skol Lata 350ml', @bebidas_id, '7891149100033', 'UN', 20, 50, '2.20', 1, 0),
('Água Mineral 500ml', @bebidas_id, '7896045501014', 'UN', 10, 30, '1.00', 1, 0),
('Salgadinho Ruffles 50g', @alimentos_id, '7892840816407', 'UN', 10, 25, '3.50', 1, 0)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Get product IDs
SET @coca_id = (SELECT id FROM products WHERE name = 'Coca Cola 2l' LIMIT 1);
SET @guarana_id = (SELECT id FROM products WHERE name = 'Guaraná Antarctica 2l' LIMIT 1);
SET @cerveja_id = (SELECT id FROM products WHERE name = 'Cerveja Skol Lata 350ml' LIMIT 1);
SET @agua_id = (SELECT id FROM products WHERE name = 'Água Mineral 500ml' LIMIT 1);
SET @salgadinho_id = (SELECT id FROM products WHERE name = 'Salgadinho Ruffles 50g' LIMIT 1);

-- Insert Product Prices for Balcão channel
INSERT INTO productPrices (productId, channelId, price) VALUES
(@coca_id, @balcao_id, '9.50'),
(@guarana_id, @balcao_id, '8.90'),
(@cerveja_id, @balcao_id, '3.50'),
(@agua_id, @balcao_id, '2.00'),
(@salgadinho_id, @balcao_id, '5.50')
ON DUPLICATE KEY UPDATE price=VALUES(price);

-- Insert Product Prices for Delivery channel
INSERT INTO productPrices (productId, channelId, price) VALUES
(@coca_id, @delivery_id, '10.50'),
(@guarana_id, @delivery_id, '9.90'),
(@cerveja_id, @delivery_id, '4.00'),
(@agua_id, @delivery_id, '2.50'),
(@salgadinho_id, @delivery_id, '6.00')
ON DUPLICATE KEY UPDATE price=VALUES(price);

-- Insert Partners (Customers)
INSERT INTO partners (name, docNumber, partnerType, phone, email, street, neighborhood, city, state, zipCode, creditLimit, creditPolicy, active, notes) VALUES
('João Silva', '123.456.789-00', 'CUSTOMER', '(11) 98765-4321', 'joao@email.com', 'Rua das Flores, 123', 'Centro', 'São Paulo', 'SP', '01234-567', '5000.00', 'ACTIVE', 1, 'Cliente VIP'),
('Maria Santos Comércio Ltda', '12.345.678/0001-90', 'CUSTOMER', '(11) 98765-4321', 'maria@santoscomercio.com.br', 'Rua Américo de Campo, 174', 'Rochdale', 'Osasco', 'SP', '06223-050', '10000.00', 'ACTIVE', 1, 'Cliente preferencial. Sempre paga em dia. Pedidos grandes aos finais de semana.'),
('Gabriel Morais Santos', '987.654.321-00', 'CUSTOMER', '(11) 91234-5678', 'gabriel@email.com', 'Av. Paulista, 1000', 'Bela Vista', 'São Paulo', 'SP', '01310-100', '500.00', 'ACTIVE', 1, NULL)
ON DUPLICATE KEY UPDATE name=VALUES(name);

SELECT 'Database seeded successfully!' as status;

