-- Migração personalizada gerada com drizzle-kit. Apenas novas tabelas; sem dados financeiros.
CREATE TABLE IF NOT EXISTS `operatorSessions` (
  `id` varchar(64) NOT NULL PRIMARY KEY,
  `userId` varchar(64) NOT NULL,
  `authenticatedAt` timestamp NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `lastActivityAt` timestamp NOT NULL,
  `lockedAt` timestamp NULL,
  `confirmedAt` timestamp NULL,
  `revokedAt` timestamp NULL,
  `userAgent` varchar(255) NULL,
  KEY `operator_session_user_idx` (`userId`, `expiresAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `operatorPins` (
  `userId` varchar(64) NOT NULL PRIMARY KEY,
  `pinHash` varchar(255) NOT NULL,
  `failedAttempts` int NOT NULL DEFAULT 0,
  `blockedUntil` timestamp NULL,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `securityPolicies` (
  `companyId` int NOT NULL PRIMARY KEY,
  `idleMinutes` int NOT NULL DEFAULT 5,
  `updatedBy` varchar(64) NOT NULL,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `securityEvents` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` varchar(64) NULL,
  `sessionId` varchar(64) NULL,
  `companyId` int NULL,
  `event` varchar(50) NOT NULL,
  `details` text NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  KEY `security_event_user_idx` (`userId`, `createdAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `productionTerminals` (
  `id` varchar(64) NOT NULL PRIMARY KEY,
  `companyId` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `tokenHash` varchar(64) NOT NULL,
  `createdBy` varchar(64) NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` timestamp NOT NULL,
  `revokedAt` timestamp NULL,
  KEY `production_terminal_company_idx` (`companyId`)
);
