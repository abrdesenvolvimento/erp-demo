ALTER TABLE `partners` ADD `street` varchar(255);--> statement-breakpoint
ALTER TABLE `partners` ADD `neighborhood` varchar(100);--> statement-breakpoint
ALTER TABLE `partners` ADD `city` varchar(100);--> statement-breakpoint
ALTER TABLE `partners` ADD `state` varchar(2);--> statement-breakpoint
ALTER TABLE `partners` ADD `zipCode` varchar(10);--> statement-breakpoint
ALTER TABLE `partners` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `partners` DROP COLUMN `address`;