ALTER TABLE `character` ADD `avatar_url` varchar(512);--> statement-breakpoint
UPDATE `character` c JOIN `user` u ON c.user_id = u.id SET c.avatar_url = u.custom_avatar_url WHERE u.custom_avatar_url IS NOT NULL;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `custom_avatar_url`;
