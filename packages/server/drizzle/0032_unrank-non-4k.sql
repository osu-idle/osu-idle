-- Custom SQL migration file, put your code below! --

-- Only 4K is playable: unrank every non-4K difficulty. The intro set (355322,
-- standard mode) is exempt - it must stay live to be served.
UPDATE `beatmap` SET `ranked` = false WHERE `keys` <> 4 AND `set_id` <> 355322;
