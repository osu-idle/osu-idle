ALTER TABLE `user` DROP INDEX `user_osuUserId_unique`;--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `osu_user_id`;