CREATE TABLE `news` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`title` varchar(200) NOT NULL,
	`summary` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`author_id` int NOT NULL,
	`published` boolean NOT NULL DEFAULT false,
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `news_id` PRIMARY KEY(`id`),
	CONSTRAINT `news_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `news` ADD CONSTRAINT `news_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;