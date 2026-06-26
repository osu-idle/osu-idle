CREATE TABLE `addon_downloads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`addon_id` int NOT NULL,
	`user_id` int NOT NULL,
	`downloaded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `addon_downloads_id` PRIMARY KEY(`id`),
	CONSTRAINT `addon_downloads_addonId_userId_unique` UNIQUE(`addon_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `skin_downloads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`skin_id` int NOT NULL,
	`user_id` int NOT NULL,
	`downloaded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `skin_downloads_id` PRIMARY KEY(`id`),
	CONSTRAINT `skin_downloads_skinId_userId_unique` UNIQUE(`skin_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `addons` ADD `downloads` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `skin` ADD `downloads` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `addon_downloads` ADD CONSTRAINT `addon_downloads_addon_id_addons_id_fk` FOREIGN KEY (`addon_id`) REFERENCES `addons`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `addon_downloads` ADD CONSTRAINT `addon_downloads_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skin_downloads` ADD CONSTRAINT `skin_downloads_skin_id_skin_id_fk` FOREIGN KEY (`skin_id`) REFERENCES `skin`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skin_downloads` ADD CONSTRAINT `skin_downloads_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;