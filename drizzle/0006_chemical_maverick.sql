CREATE TABLE `expenseCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenseCategories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenseInstallments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expenseId` int NOT NULL,
	`installmentNumber` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`dueDate` timestamp NOT NULL,
	`paymentDate` timestamp,
	`paymentAmount` decimal(10,2),
	`paymentMethod` enum('DINHEIRO','PIX','CARTAO_DEBITO','CARTAO_CREDITO','TRANSFERENCIA','BOLETO'),
	`status` enum('PENDENTE','PAGO','VENCIDO','CANCELADO') NOT NULL DEFAULT 'PENDENTE',
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenseInstallments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`description` varchar(255) NOT NULL,
	`totalAmount` decimal(10,2) NOT NULL,
	`paymentType` enum('AVISTA','PARCELADO') NOT NULL,
	`installments` int NOT NULL DEFAULT 1,
	`dueDay` int,
	`firstDueDate` timestamp NOT NULL,
	`supplierId` int,
	`notes` text,
	`status` enum('ATIVA','CANCELADA') NOT NULL DEFAULT 'ATIVA',
	`createdBy` varchar(64) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `expense_idx` ON `expenseInstallments` (`expenseId`);--> statement-breakpoint
CREATE INDEX `due_date_idx` ON `expenseInstallments` (`dueDate`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `expenseInstallments` (`status`);--> statement-breakpoint
CREATE INDEX `category_idx` ON `expenses` (`categoryId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `expenses` (`status`);--> statement-breakpoint
CREATE INDEX `supplier_idx` ON `expenses` (`supplierId`);