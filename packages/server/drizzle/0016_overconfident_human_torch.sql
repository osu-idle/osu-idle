CREATE TABLE `first_place` (
	`id` int NOT NULL,
	`character_id` int NOT NULL,
	`beatmap_id` int NOT NULL,
	`score` int NOT NULL,
	`accuracy` decimal(10,5) NOT NULL,
	`max_combo` int NOT NULL,
	`marvelous` int NOT NULL DEFAULT 0,
	`perfect` int NOT NULL DEFAULT 0,
	`great` int NOT NULL DEFAULT 0,
	`good` int NOT NULL DEFAULT 0,
	`bad` int NOT NULL DEFAULT 0,
	`miss` int NOT NULL DEFAULT 0,
	`grade` enum('X','SS','S','A','B','C','D','F') NOT NULL,
	`pp` decimal(10,3) NOT NULL,
	`ur` decimal(10,3) NOT NULL,
	`pfc` boolean NOT NULL,
	`played_at` timestamp DEFAULT (now()),
	CONSTRAINT `first_place_beatmap_id_pk` PRIMARY KEY(`beatmap_id`)
);
--> statement-breakpoint
ALTER TABLE `first_place` ADD CONSTRAINT `first_place_id_score_id_fk` FOREIGN KEY (`id`) REFERENCES `score`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `first_place` ADD CONSTRAINT `first_place_character_id_character_id_fk` FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON DELETE cascade ON UPDATE no action;