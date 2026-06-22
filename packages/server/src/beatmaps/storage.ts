import { join } from 'node:path';

/**
 * On-disk homes for the beatmap corpus and the generated previews. Deliberately
 * server-owned and **outside any build output** (like {@link UPLOAD_DIR}): no
 * client/web build writes here or can wipe it, so the downloadable content
 * survives every deploy. Paths are relative to the server's working directory.
 *
 * Names are derived from the set id, never the raw osu! folder names (full of
 * `#`, spaces and URL sub-delimiters that have bitten us before). One `.osz` per
 * set; previews are one file per *distinct* audio/background source in the set,
 * since difficulties can carry their own song/background - the first keeps the
 * bare `<setId>.mp3` / `<setId>.jpg`, the rest get `<setId>-audio2.mp3`,
 * `<setId>-bg2.jpg`, …
 */
export const BEATMAP_DIR = './beatmaps';
export const PREVIEW_DIR = './previews';

export const oszPath = (setId: number) => join(BEATMAP_DIR, `${setId}.osz`);
export const previewPath = (file: string) => join(PREVIEW_DIR, file);
