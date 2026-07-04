CREATE TABLE `skill_milestone` (
	`character_id` int NOT NULL,
	`skill` varchar(32) NOT NULL,
	`level` int NOT NULL,
	CONSTRAINT `skill_milestone_character_id_skill_pk` PRIMARY KEY(`character_id`,`skill`)
);
--> statement-breakpoint
ALTER TABLE `skill_milestone` ADD CONSTRAINT `skill_milestone_character_id_character_id_fk` FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON DELETE cascade ON UPDATE no action;