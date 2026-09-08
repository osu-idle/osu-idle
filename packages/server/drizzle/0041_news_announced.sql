-- Marks an article as already posted to the Discord news feed, so re-saving a
-- published article never announces it twice. Existing articles are backfilled
-- as announced - they went out (or deliberately didn't) long ago.
ALTER TABLE `news` ADD COLUMN `announced` boolean NOT NULL DEFAULT false;--> statement-breakpoint
UPDATE `news` SET `announced` = true WHERE `published` = true;
