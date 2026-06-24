CREATE TABLE `skin` (
	`id` int AUTO_INCREMENT NOT NULL,
	`author_id` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`description` varchar(500) NOT NULL DEFAULT '',
	`tags` varchar(255) NOT NULL DEFAULT '',
	`icon` varchar(512),
	`version` varchar(20) NOT NULL DEFAULT '0.1.0',
	`definition` longtext NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'UNPUBLISHED',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`published_at` timestamp,
	CONSTRAINT `skin_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `addons` MODIFY COLUMN `source` longtext NOT NULL;--> statement-breakpoint
ALTER TABLE `addons` MODIFY COLUMN `reviewed_source` longtext;--> statement-breakpoint
ALTER TABLE `skin` ADD CONSTRAINT `skin_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;