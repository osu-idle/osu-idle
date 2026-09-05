ALTER TABLE `character` MODIFY COLUMN `accuracy_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `accuracy_total_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `speed_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `speed_total_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `stamina_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `stamina_total_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `jackspeed_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `jackspeed_total_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `coordination_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `coordination_total_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `release_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `release_total_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `reading_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `reading_total_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `consistency_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `consistency_total_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `concentration_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `concentration_total_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `speedjam_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `speedjam_total_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `memory_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `memory_total_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `overall_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` MODIFY COLUMN `overall_total_xp` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `character` ADD `accuracy_lifetime_xp` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `accuracy_prestige` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `speed_lifetime_xp` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `speed_prestige` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `stamina_lifetime_xp` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `stamina_prestige` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `jackspeed_lifetime_xp` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `jackspeed_prestige` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `coordination_lifetime_xp` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `coordination_prestige` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `release_lifetime_xp` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `release_prestige` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `reading_lifetime_xp` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `reading_prestige` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `consistency_lifetime_xp` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `consistency_prestige` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `concentration_lifetime_xp` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `concentration_prestige` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `speedjam_lifetime_xp` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `speedjam_prestige` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `memory_lifetime_xp` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `memory_prestige` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `overall_lifetime_xp` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `character` ADD `generation` int DEFAULT 1 NOT NULL;