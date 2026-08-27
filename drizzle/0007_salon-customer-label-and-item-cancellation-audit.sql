-- Migração aditiva e não destrutiva da primeira entrega do módulo Salão.
-- Não modifica comandas ou itens existentes; os novos campos permanecem nulos
-- até que sejam preenchidos em operações futuras.
ALTER TABLE `salonOrders` ADD COLUMN IF NOT EXISTS `customerLabel` varchar(100);
ALTER TABLE `salonOrderItems` ADD COLUMN IF NOT EXISTS `cancelledAt` timestamp NULL;
ALTER TABLE `salonOrderItems` ADD COLUMN IF NOT EXISTS `cancelledBy` varchar(64);
ALTER TABLE `salonOrderItems` ADD COLUMN IF NOT EXISTS `cancellationReason` varchar(500);
