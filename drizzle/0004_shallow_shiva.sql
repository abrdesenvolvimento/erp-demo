CREATE TABLE `purchaseInstallments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`installmentNumber` int NOT NULL,
	`dueDate` timestamp NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`paidDate` timestamp,
	`status` enum('PENDING','PAID','OVERDUE') NOT NULL DEFAULT 'PENDING',
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchaseInstallments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD `accessKey` varchar(44);--> statement-breakpoint
CREATE INDEX `po_idx` ON `purchaseInstallments` (`purchaseOrderId`);--> statement-breakpoint
CREATE INDEX `due_date_idx` ON `purchaseInstallments` (`dueDate`);--> statement-breakpoint
ALTER TABLE `purchaseOrders` DROP COLUMN `dueDate`;