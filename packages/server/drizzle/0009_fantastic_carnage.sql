ALTER TABLE `character` ADD `total_score` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `ranked_score` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `pp` decimal(10,3) DEFAULT '0' NOT NULL;