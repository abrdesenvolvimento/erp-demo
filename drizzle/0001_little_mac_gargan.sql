CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`docNumber` varchar(20),
	`partnerType` enum('CUSTOMER','SUPPLIER','BOTH') NOT NULL,
	`phone` varchar(20),
	`email` varchar(320),
	`address` text,
	`creditLimit` decimal(10,2) DEFAULT '0.00',
	`currentBalance` decimal(10,2) DEFAULT '0.00',
	`creditPolicy` enum('ACTIVE','BLOCKED') DEFAULT 'ACTIVE',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productCompositions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parentProductId` int NOT NULL,
	`childProductId` int NOT NULL,
	`quantity` int NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `productCompositions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productPrices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`channelId` int NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`effectiveFrom` timestamp DEFAULT (now()),
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productPrices_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_channel_idx` UNIQUE(`productId`,`channelId`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`categoryId` int NOT NULL,
	`subcategoryId` int,
	`ean` varchar(20),
	`uom` varchar(10) NOT NULL,
	`minStock` int DEFAULT 0,
	`currentStock` int DEFAULT 0,
	`avgCost` decimal(10,2) DEFAULT '0.00',
	`active` boolean NOT NULL DEFAULT true,
	`isComposite` boolean NOT NULL DEFAULT false,
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saleItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL,
	`unitPrice` decimal(10,2) NOT NULL,
	`totalPrice` decimal(10,2) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `saleItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleType` enum('BALCAO','DELIVERY','A_PRAZO') NOT NULL,
	`saleDate` timestamp DEFAULT (now()),
	`customerId` int,
	`channelId` int,
	`platformOrderId` varchar(100),
	`subtotal` decimal(10,2) NOT NULL,
	`discountAmount` decimal(10,2) DEFAULT '0.00',
	`surchargeAmount` decimal(10,2) DEFAULT '0.00',
	`finalAmount` decimal(10,2) NOT NULL,
	`paymentMethod` varchar(50),
	`requiresAdminApproval` boolean DEFAULT false,
	`adminApprovedBy` varchar(64),
	`notes` text,
	`createdBy` varchar(64) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salesChannels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('BALCAO','DELIVERY') NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salesChannels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subcategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`categoryId` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subcategories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `doc_idx` ON `partners` (`docNumber`);--> statement-breakpoint
CREATE INDEX `ean_idx` ON `products` (`ean`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `products` (`name`);--> statement-breakpoint
CREATE INDEX `date_idx` ON `sales` (`saleDate`);--> statement-breakpoint
CREATE INDEX `customer_idx` ON `sales` (`customerId`);