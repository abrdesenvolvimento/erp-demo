-- Origem da venda separada do canal: registros existentes permanecem NULL.
-- Sem UPDATE/backfill e sem alterações financeiras ou de estoque.
ALTER TABLE `sales` ADD COLUMN `deliveryPlatform` varchar(32) NULL;
