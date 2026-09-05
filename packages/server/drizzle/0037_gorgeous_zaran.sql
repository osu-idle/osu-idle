ALTER TABLE `best_pp` MODIFY COLUMN `grade` enum('Z','X','SS','S','A','B','C','D','F') NOT NULL;--> statement-breakpoint
ALTER TABLE `best` MODIFY COLUMN `grade` enum('Z','X','SS','S','A','B','C','D','F') NOT NULL;--> statement-breakpoint
ALTER TABLE `first_place` MODIFY COLUMN `grade` enum('Z','X','SS','S','A','B','C','D','F') NOT NULL;--> statement-breakpoint
ALTER TABLE `score` MODIFY COLUMN `grade` enum('Z','X','SS','S','A','B','C','D','F') NOT NULL;--> statement-breakpoint
ALTER TABLE `best_pp` ADD `divine` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `best` ADD `divine` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character_totals` ADD `divine` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character_totals` ADD `z` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `first_place` ADD `divine` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `score` ADD `divine` int DEFAULT 0 NOT NULL;