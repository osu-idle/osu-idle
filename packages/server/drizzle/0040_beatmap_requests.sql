-- Player-facing ranking propositions: one row per requested beatmapset, plus the
-- players backing it. Written by hand like 0038/0039 - the drizzle snapshot
-- stopped at 0037, so `generate` would re-emit those two.
CREATE TABLE `beatmap_request` (
	`set_id` int NOT NULL,
	`user_id` int NOT NULL,
	`artist` text NOT NULL,
	`title` text NOT NULL,
	`creator` text NOT NULL,
	`status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`resolved_at` timestamp,
	`resolved_by` int,
	CONSTRAINT `beatmap_request_set_id` PRIMARY KEY(`set_id`)
);
--> statement-breakpoint
CREATE INDEX `beatmap_request_user_idx` ON `beatmap_request` (`user_id`);
--> statement-breakpoint
CREATE TABLE `beatmap_request_vote` (
	`set_id` int NOT NULL,
	`user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `beatmap_request_vote_set_id_user_id_pk` PRIMARY KEY(`set_id`,`user_id`)
);
--> statement-breakpoint
CREATE INDEX `beatmap_request_vote_user_idx` ON `beatmap_request_vote` (`user_id`);
