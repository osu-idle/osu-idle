-- Lifetime xp was added (0036) defaulting to 0 and never backfilled, so it only
-- ever counted xp earned after that deploy: a character who had played for
-- months read as lifetime level 0. Seed it from the running total, which is the
-- closest thing we ever recorded.
--
-- GREATEST, not a plain copy: the total is what upgrades spend out of, so a
-- player who has bought a lot can hold less in it than they have earned since
-- 0036. Whichever is higher is the better floor, and neither can overstate a
-- lifetime that spending never takes back.
UPDATE `character` SET `accuracy_lifetime_xp` = GREATEST(`accuracy_lifetime_xp`, `accuracy_total_xp`);--> statement-breakpoint
UPDATE `character` SET `speed_lifetime_xp` = GREATEST(`speed_lifetime_xp`, `speed_total_xp`);--> statement-breakpoint
UPDATE `character` SET `stamina_lifetime_xp` = GREATEST(`stamina_lifetime_xp`, `stamina_total_xp`);--> statement-breakpoint
UPDATE `character` SET `jackspeed_lifetime_xp` = GREATEST(`jackspeed_lifetime_xp`, `jackspeed_total_xp`);--> statement-breakpoint
UPDATE `character` SET `coordination_lifetime_xp` = GREATEST(`coordination_lifetime_xp`, `coordination_total_xp`);--> statement-breakpoint
UPDATE `character` SET `release_lifetime_xp` = GREATEST(`release_lifetime_xp`, `release_total_xp`);--> statement-breakpoint
UPDATE `character` SET `reading_lifetime_xp` = GREATEST(`reading_lifetime_xp`, `reading_total_xp`);--> statement-breakpoint
UPDATE `character` SET `consistency_lifetime_xp` = GREATEST(`consistency_lifetime_xp`, `consistency_total_xp`);--> statement-breakpoint
UPDATE `character` SET `concentration_lifetime_xp` = GREATEST(`concentration_lifetime_xp`, `concentration_total_xp`);--> statement-breakpoint
UPDATE `character` SET `speedjam_lifetime_xp` = GREATEST(`speedjam_lifetime_xp`, `speedjam_total_xp`);--> statement-breakpoint
UPDATE `character` SET `memory_lifetime_xp` = GREATEST(`memory_lifetime_xp`, `memory_total_xp`);--> statement-breakpoint
UPDATE `character` SET `overall_lifetime_xp` = GREATEST(`overall_lifetime_xp`, `overall_total_xp`);
