-- Migração aditiva da trava de concorrência do backup incremental.
-- Apenas a execução ACTIVE ocupa activeSlot=1; execuções concluídas/falhas usam NULL,
-- permitindo histórico ilimitado e impedindo dois ciclos ativos simultaneamente.
ALTER TABLE `backupRuns` ADD COLUMN `activeSlot` int NULL;
--> statement-breakpoint
UPDATE `backupRuns` SET `activeSlot` = 1 WHERE `status` = 'ACTIVE';
--> statement-breakpoint
CREATE UNIQUE INDEX `backup_single_active_idx` ON `backupRuns` (`activeSlot`);
