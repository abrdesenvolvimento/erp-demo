-- Preparar fora da janela de callbacks, após preservar/encerrar o ciclo legado ativo.
-- Ativar o novo handler somente após publicar e verificar o protocolo 2.
-- Tabela de metadados: não altera vendas, estoque, pagamentos ou contabilidade.
CREATE TABLE IF NOT EXISTS `backupHealthAlerts` (
  `id` varchar(64) NOT NULL,
  `reason` varchar(32) NOT NULL,
  `status` varchar(16) NOT NULL,
  `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finishedAt` timestamp(3) NULL,
  PRIMARY KEY (`id`),
  KEY `backup_health_created_idx` (`createdAt`)
);
