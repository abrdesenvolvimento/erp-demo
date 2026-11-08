-- Aplicação manual pelo responsável; NÃO executar com backend v1 em atividade.
-- Publicar protocolo 2 e ativar somente após confirmar recibos/versionamento.
-- Defaults preservam explicitamente os ciclos legados (protocolo 1).
ALTER TABLE `backupRuns`
  ADD COLUMN `leaseOwner` varchar(36) NULL,
  ADD COLUMN `leaseExpiresAt` timestamp NULL,
  ADD COLUMN `leaseVersion` int NOT NULL DEFAULT 0,
  ADD COLUMN `progressProtocol` int NOT NULL DEFAULT 1,
  ADD COLUMN `planJson` longtext NULL,
  ADD COLUMN `manifestKey` varchar(500) NULL;
