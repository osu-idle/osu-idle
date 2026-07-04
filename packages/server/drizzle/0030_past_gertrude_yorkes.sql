CREATE TABLE `character_name_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`character_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`changed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `character_name_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `character_name_history` ADD CONSTRAINT `character_name_history_character_id_character_id_fk` FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON DELETE cascade ON UPDATE no action;