CREATE TABLE `activityLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`customerId` int,
	`action` varchar(100) NOT NULL,
	`description` text,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activityLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(320),
	`sourceId` int NOT NULL,
	`assignedToSalesId` int NOT NULL,
	`status` enum('new_lead','qualified','unqualified','in_progress','sales_opportunity','closed_won','closed_lost','inactive') NOT NULL DEFAULT 'new_lead',
	`isQualified` boolean DEFAULT false,
	`interestLevel` enum('interested','thinking','not_interested'),
	`isDuplicate` boolean DEFAULT false,
	`duplicateOfId` int,
	`externalId` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `followUps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`assignedToSalesId` int NOT NULL,
	`scheduledDate` timestamp NOT NULL,
	`status` enum('pending','completed','cancelled','rescheduled') NOT NULL DEFAULT 'pending',
	`reason` text,
	`result` text,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `followUps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `installmentApplications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`partnerId` int NOT NULL,
	`status` enum('submitted','pending','approved','rejected','customer_rejected') NOT NULL DEFAULT 'submitted',
	`loanAmount` decimal(12,2),
	`monthlyPayment` decimal(12,2),
	`duration` int,
	`reason` text,
	`requiredDocuments` text,
	`submittedDocuments` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `installmentApplications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `installmentPartners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` enum('drive','contact','aman','one_finance','bedaya','bank') NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `installmentPartners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leadSources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` enum('external_call','facebook_leads','referral','existing_customer') NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadSources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lostDeals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`closedBySalesId` int NOT NULL,
	`reason` text NOT NULL,
	`reasonCategory` enum('customer_not_interested','financing_rejected','found_competitor','price_issue','timing_issue','other') NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lostDeals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salesNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`createdBySalesId` int NOT NULL,
	`note` text NOT NULL,
	`noteType` enum('call','whatsapp','email','meeting','follow_up') NOT NULL,
	`outcome` enum('interested','thinking','not_interested','qualified','unqualified'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salesNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salesOpportunities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`installmentApplicationId` int NOT NULL,
	`vehicleType` enum('new','used') NOT NULL,
	`vehicleModel` varchar(100),
	`vehiclePrice` decimal(12,2),
	`status` enum('inspection_pending','quote_pending','contract_pending','registration_pending','completed','cancelled') NOT NULL DEFAULT 'inspection_pending',
	`inspectionDate` timestamp,
	`inspectionResult` text,
	`quoteDate` timestamp,
	`quoteDetails` text,
	`contractSignedDate` timestamp,
	`registrationDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salesOpportunities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` text NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('sales_manager','team_leader','sales','moderator') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `teamId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_userId` ON `activityLog` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_customerId` ON `activityLog` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_createdAt` ON `activityLog` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_phone` ON `customers` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_assignedToSalesId` ON `customers` (`assignedToSalesId`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `customers` (`status`);--> statement-breakpoint
CREATE INDEX `idx_isDuplicate` ON `customers` (`isDuplicate`);--> statement-breakpoint
CREATE INDEX `idx_customerId` ON `followUps` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_assignedToSalesId` ON `followUps` (`assignedToSalesId`);--> statement-breakpoint
CREATE INDEX `idx_scheduledDate` ON `followUps` (`scheduledDate`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `followUps` (`status`);--> statement-breakpoint
CREATE INDEX `idx_customerId` ON `installmentApplications` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_partnerId` ON `installmentApplications` (`partnerId`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `installmentApplications` (`status`);--> statement-breakpoint
CREATE INDEX `idx_customerId` ON `lostDeals` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_closedBySalesId` ON `lostDeals` (`closedBySalesId`);--> statement-breakpoint
CREATE INDEX `idx_customerId` ON `salesNotes` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_createdBySalesId` ON `salesNotes` (`createdBySalesId`);--> statement-breakpoint
CREATE INDEX `idx_customerId` ON `salesOpportunities` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `salesOpportunities` (`status`);--> statement-breakpoint
CREATE INDEX `idx_role` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_teamId` ON `users` (`teamId`);