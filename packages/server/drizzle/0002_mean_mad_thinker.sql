CREATE TABLE `beatmap` (
	`id` int NOT NULL,
	`sr` decimal(10,3) NOT NULL,
	`artist` text NOT NULL,
	`title` text NOT NULL,
	`version` text NOT NULL,
	`keys` int NOT NULL,
	`total_length` int NOT NULL,
	CONSTRAINT `beatmap_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `score` (
	`id` int AUTO_INCREMENT NOT NULL,
	`character_id` int NOT NULL,
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
	CONSTRAINT `score_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `score` ADD CONSTRAINT `score_character_id_character_id_fk` FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON DELETE cascade ON UPDATE no action;