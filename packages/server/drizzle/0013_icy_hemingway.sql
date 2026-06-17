CREATE TABLE `beatmaps_played` (
	`character_id` int NOT NULL,
	`beatmap_id` int NOT NULL,
	`plays` int NOT NULL DEFAULT 0,
	CONSTRAINT `beatmaps_played_character_id_beatmap_id_pk` PRIMARY KEY(`character_id`,`beatmap_id`)
);
--> statement-breakpoint
ALTER TABLE `beatmaps_played` ADD CONSTRAINT `beatmaps_played_character_id_character_id_fk` FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `beatmaps_played` ADD CONSTRAINT `beatmaps_played_beatmap_id_beatmap_id_fk` FOREIGN KEY (`beatmap_id`) REFERENCES `beatmap`(`id`) ON DELETE cascade ON UPDATE no action;