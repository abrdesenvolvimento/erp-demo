CREATE TABLE `accountsPayable` (
	`id` int AUTO_INCREMENT NOT NULL,
	`description` varchar(255) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`dueDate` timestamp NOT NULL,
	`paidDate` timestamp,
	`status` enum('PENDING','PAID','OVERDUE','CANCELLED') NOT NULL DEFAULT 'PENDING',
	`supplierId` int,
	`purchaseOrderId` int,
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accountsPayable_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` decimal(10,3) NOT NULL,
	`unitCost` decimal(10,4) NOT NULL,
	`totalCost` decimal(10,2) NOT NULL,
	`expiryDate` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `purchaseOrderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int NOT NULL,
	`docType` enum('NOTA_FISCAL','CUPOM','SEM_DOCUMENTO') NOT NULL,
	`docNumber` varchar(100),
	`issueDate` timestamp NOT NULL,
	`postingDate` timestamp NOT NULL,
	`totalAmount` decimal(10,2) NOT NULL,
	`freightCost` decimal(10,2) DEFAULT '0.00',
	`chargesCost` decimal(10,2) DEFAULT '0.00',
	`paymentMethod` varchar(50) NOT NULL,
	`dueDate` timestamp,
	`invoiceFilePath` varchar(255),
	`status` enum('DRAFT','CONFIRMED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`notes` text,
	`createdBy` varchar(64) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchaseOrders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `status_idx` ON `accountsPayable` (`status`);--> statement-breakpoint
CREATE INDEX `due_date_idx` ON `accountsPayable` (`dueDate`);--> statement-breakpoint
CREATE INDEX `supplier_idx` ON `accountsPayable` (`supplierId`);--> statement-breakpoint
CREATE INDEX `po_idx` ON `purchaseOrderItems` (`purchaseOrderId`);--> statement-breakpoint
CREATE INDEX `product_idx` ON `purchaseOrderItems` (`productId`);--> statement-breakpoint
CREATE INDEX `supplier_idx` ON `purchaseOrders` (`supplierId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `purchaseOrders` (`status`);--> statement-breakpoint
CREATE INDEX `date_idx` ON `purchaseOrders` (`postingDate`);