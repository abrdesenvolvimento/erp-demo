CREATE TABLE `consumptionEmployees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `companyId` int NOT NULL,
  `name` varchar(200) NOT NULL,
  `active` boolean NOT NULL DEFAULT true,
  `createdBy` varchar(64) NOT NULL,
  `updatedBy` varchar(64) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `consumption_employee_company_idx` (`companyId`, `active`)
);

CREATE TABLE `consumptionRecords` (
  `id` int NOT NULL AUTO_INCREMENT,
  `companyId` int NOT NULL,
  `branchId` int NOT NULL,
  `employeeId` int NOT NULL,
  `employeeName` varchar(200) NOT NULL,
  `consumedAt` timestamp(3) NOT NULL,
  `reason` varchar(2000) NOT NULL,
  `totalCost` decimal(15,2) NOT NULL,
  `totalUnits` int NOT NULL,
  `status` enum('ACTIVE','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `requestKey` varchar(36) NOT NULL,
  `payloadHash` varchar(64) NOT NULL,
  `createdBy` varchar(64) NOT NULL,
  `createdByName` varchar(200) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `cancelledAt` timestamp(3) NULL,
  `cancelledBy` varchar(64) NULL,
  `cancelledByName` varchar(200) NULL,
  `cancellationReason` varchar(2000) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `consumption_company_request_idx` (`companyId`, `requestKey`),
  KEY `consumption_company_branch_date_idx` (`companyId`, `branchId`, `consumedAt`),
  KEY `consumption_company_employee_idx` (`companyId`, `employeeId`)
);

CREATE TABLE `consumptionItems` (
  `id` int NOT NULL AUTO_INCREMENT,
  `companyId` int NOT NULL,
  `branchId` int NOT NULL,
  `consumptionId` int NOT NULL,
  `productId` int NOT NULL,
  `productName` varchar(200) NOT NULL,
  `uom` varchar(10) NOT NULL,
  `quantity` int NOT NULL,
  `unitCost` decimal(15,2) NOT NULL,
  `totalCost` decimal(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `consumption_item_record_idx` (`companyId`, `branchId`, `consumptionId`)
);

CREATE TABLE `consumptionStockItems` (
  `id` int NOT NULL AUTO_INCREMENT,
  `companyId` int NOT NULL,
  `branchId` int NOT NULL,
  `consumptionId` int NOT NULL,
  `productId` int NOT NULL,
  `productName` varchar(200) NOT NULL,
  `uom` varchar(10) NOT NULL,
  `quantity` int NOT NULL,
  `unitCost` decimal(15,2) NOT NULL,
  `totalCost` decimal(15,2) NOT NULL,
  `movementId` int NOT NULL,
  `reversalMovementId` int NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `consumption_stock_record_product_idx` (`companyId`, `branchId`, `consumptionId`, `productId`)
);
