ALTER TABLE `episodes` ADD COLUMN `isPremium` boolean NOT NULL DEFAULT false;

ALTER TABLE `users` ADD COLUMN `memberUntil` timestamp NULL;

ALTER TABLE `users` ADD COLUMN `notifiedSignup` boolean NOT NULL DEFAULT true;

CREATE TABLE `settings` (
	`key` varchar(64) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);

CREATE TABLE `payment_requests` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`amount` int NOT NULL,
	`note` varchar(500),
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` bigint unsigned,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_requests_id` PRIMARY KEY(`id`)
);

ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;

ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_reviewedBy_users_id_fk` FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;

CREATE INDEX `payment_status_created_idx` ON `payment_requests` (`status`,`createdAt`);

CREATE INDEX `payment_user_idx` ON `payment_requests` (`userId`);

INSERT IGNORE INTO `settings` (`key`, `value`) VALUES
	('paymentsEnabled', '0'),
	('priceLabel', ''),
	('memberDays', '30'),
	('qrKey', ''),
	('qrUrl', '');
