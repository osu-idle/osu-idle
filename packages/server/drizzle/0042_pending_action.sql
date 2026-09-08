-- The one character action a running play has deferred to its end (an upgrade,
-- a prestige or a rebirth). Written by hand like 0038-0041 - the drizzle
-- snapshot stopped at 0037, so `generate` would re-emit those.
ALTER TABLE `character` ADD COLUMN `pending_action` json;
