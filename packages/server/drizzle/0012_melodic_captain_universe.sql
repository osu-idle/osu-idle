CREATE TABLE `best_pp` (
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
	CONSTRAINT `best_pp_character_id_beatmap_id_pk` PRIMARY KEY(`character_id`,`beatmap_id`)
);
--> statement-breakpoint
CREATE TABLE `best` (
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
	CONSTRAINT `best_character_id_beatmap_id_pk` PRIMARY KEY(`character_id`,`beatmap_id`)
);
--> statement-breakpoint
CREATE TABLE `character_totals` (
	`id` int NOT NULL,
	`total_score` bigint NOT NULL DEFAULT 0,
	`ranked_score` bigint NOT NULL DEFAULT 0,
	`hits` bigint NOT NULL DEFAULT 0,
	`play_count` bigint NOT NULL DEFAULT 0,
	`play_time` bigint NOT NULL DEFAULT 0,
	`marvelous` bigint NOT NULL DEFAULT 0,
	`perfect` bigint NOT NULL DEFAULT 0,
	`great` bigint NOT NULL DEFAULT 0,
	`good` bigint NOT NULL DEFAULT 0,
	`bad` bigint NOT NULL DEFAULT 0,
	`miss` bigint NOT NULL DEFAULT 0,
	`x` bigint NOT NULL DEFAULT 0,
	`ss` bigint NOT NULL DEFAULT 0,
	`s` bigint NOT NULL DEFAULT 0,
	`a` bigint NOT NULL DEFAULT 0,
	`b` bigint NOT NULL DEFAULT 0,
	`c` bigint NOT NULL DEFAULT 0,
	`d` bigint NOT NULL DEFAULT 0,
	`f` bigint NOT NULL DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE `best_pp` ADD CONSTRAINT `best_pp_id_score_id_fk` FOREIGN KEY (`id`) REFERENCES `score`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `best_pp` ADD CONSTRAINT `best_pp_character_id_character_id_fk` FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `best` ADD CONSTRAINT `best_id_score_id_fk` FOREIGN KEY (`id`) REFERENCES `score`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `best` ADD CONSTRAINT `best_character_id_character_id_fk` FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `character_totals` ADD CONSTRAINT `character_totals_id_character_id_fk` FOREIGN KEY (`id`) REFERENCES `character`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `beatmap_idx` ON `best_pp` (`beatmap_id`);--> statement-breakpoint
CREATE INDEX `beatmap_idx` ON `best` (`beatmap_id`);--> statement-breakpoint
CREATE INDEX `character_beatmap_idx` ON `score` (`character_id`,`beatmap_id`);--> statement-breakpoint
CREATE INDEX `beatmap_idx` ON `score` (`beatmap_id`);--> statement-breakpoint
ALTER TABLE `character` DROP COLUMN `total_score`;--> statement-breakpoint
ALTER TABLE `character` DROP COLUMN `ranked_score`;