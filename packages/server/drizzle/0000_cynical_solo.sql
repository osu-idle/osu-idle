CREATE TABLE `user` (
	`id` int AUTO_INCREMENT NOT NULL,
	`osu_user_id` int NOT NULL,
	`username` varchar(255) NOT NULL,
	`avatar_url` varchar(512),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_osuUserId_unique` UNIQUE(`osu_user_id`)
);
--> statement-breakpoint
CREATE TABLE `character` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`accuracy_level` int NOT NULL DEFAULT 0,
	`accuracy_xp` int NOT NULL DEFAULT 0,
	`speed_level` int NOT NULL DEFAULT 0,
	`speed_xp` int NOT NULL DEFAULT 0,
	`stamina_level` int NOT NULL DEFAULT 0,
	`stamina_xp` int NOT NULL DEFAULT 0,
	`coordination_level` int NOT NULL DEFAULT 0,
	`coordination_xp` int NOT NULL DEFAULT 0,
	`consistency_level` int NOT NULL DEFAULT 0,
	`consistency_xp` int NOT NULL DEFAULT 0,
	`jackspeed_level` int NOT NULL DEFAULT 0,
	`jackspeed_xp` int NOT NULL DEFAULT 0,
	`reading_level` int NOT NULL DEFAULT 0,
	`reading_xp` int NOT NULL DEFAULT 0,
	`memory_level` int NOT NULL DEFAULT 0,
	`memory_xp` int NOT NULL DEFAULT 0,
	`concentration_level` int NOT NULL DEFAULT 0,
	`concentration_xp` int NOT NULL DEFAULT 0,
	`release_level` int NOT NULL DEFAULT 0,
	`release_xp` int NOT NULL DEFAULT 0,
	`speedjam_level` int NOT NULL DEFAULT 0,
	`speedjam_xp` int NOT NULL DEFAULT 0,
	CONSTRAINT `character_id` PRIMARY KEY(`id`)
) AUTO_INCREMENT = 2;
--> statement-breakpoint
ALTER TABLE `character` ADD CONSTRAINT `character_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;