ALTER TABLE `beatmapset` MODIFY COLUMN `ranked_at` timestamp;--> statement-breakpoint
ALTER TABLE `beatmap` ADD `bpm` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `beatmap` ADD `objects` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `beatmap` ADD `rice` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `beatmap` ADD `ln` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `beatmap` ADD `mode` int DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `beatmap` ADD `audio` text;--> statement-breakpoint
ALTER TABLE `beatmap` ADD `background` text;--> statement-breakpoint
ALTER TABLE `beatmapset` ADD `status` enum('pending','ranked','rejected') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `beatmapset` ADD `announced` boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Every set that already exists was live; mark it ranked + already announced so
-- the rank sweep never re-posts it. Sets added later default to pending.
UPDATE `beatmapset` SET `status` = 'ranked', `announced` = true;