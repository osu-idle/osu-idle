-- The top grade is XX, not Z. Widen each enum to hold both, move the rows over,
-- then narrow it - a straight swap would drop every existing Z on the floor.
ALTER TABLE `score` MODIFY COLUMN `grade` enum('XX','Z','X','SS','S','A','B','C','D','F') NOT NULL;--> statement-breakpoint
ALTER TABLE `best` MODIFY COLUMN `grade` enum('XX','Z','X','SS','S','A','B','C','D','F') NOT NULL;--> statement-breakpoint
ALTER TABLE `best_pp` MODIFY COLUMN `grade` enum('XX','Z','X','SS','S','A','B','C','D','F') NOT NULL;--> statement-breakpoint
ALTER TABLE `first_place` MODIFY COLUMN `grade` enum('XX','Z','X','SS','S','A','B','C','D','F') NOT NULL;--> statement-breakpoint
UPDATE `score` SET `grade` = 'XX' WHERE `grade` = 'Z';--> statement-breakpoint
UPDATE `best` SET `grade` = 'XX' WHERE `grade` = 'Z';--> statement-breakpoint
UPDATE `best_pp` SET `grade` = 'XX' WHERE `grade` = 'Z';--> statement-breakpoint
UPDATE `first_place` SET `grade` = 'XX' WHERE `grade` = 'Z';--> statement-breakpoint
ALTER TABLE `score` MODIFY COLUMN `grade` enum('XX','X','SS','S','A','B','C','D','F') NOT NULL;--> statement-breakpoint
ALTER TABLE `best` MODIFY COLUMN `grade` enum('XX','X','SS','S','A','B','C','D','F') NOT NULL;--> statement-breakpoint
ALTER TABLE `best_pp` MODIFY COLUMN `grade` enum('XX','X','SS','S','A','B','C','D','F') NOT NULL;--> statement-breakpoint
ALTER TABLE `first_place` MODIFY COLUMN `grade` enum('XX','X','SS','S','A','B','C','D','F') NOT NULL;--> statement-breakpoint
ALTER TABLE `character_totals` CHANGE COLUMN `z` `xx` bigint NOT NULL DEFAULT 0;
