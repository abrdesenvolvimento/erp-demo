-- Migração aditiva e não destrutiva.
-- Combos iFood virtuais podem representar várias unidades do produto ABRWF.
ALTER TABLE `ifoodProductMappings`
  ADD COLUMN `quantityMultiplier` int NOT NULL DEFAULT 1;
