import LightBeatmap from './LightBeatmap';
import LightBeatmapSet from './LightBeatmapSet';

/**
 * osu! stable-style song-select search. The query is split on whitespace; every
 * term must match (AND). A term shaped like `key<op>value` (e.g. `stars>5`,
 * `keys=4`, `creator=sotarks`) is a filter; anything else is plain text matched
 * (case-insensitive substring) against artist, title, creator and difficulty
 * name. Numeric operators: `>`, `<`, `>=`, `<=`, `=`/`:`.
 *
 * Works on both carousel item kinds: a downloaded `RuntimeBeatmap` (fields from
 * the parsed beatmap + computed stars) and a remote `VersionMetadata` paired
 * with its set `Metadata` (fields straight from the manifest).
 */
export function matchesSearch(
	beatmap: LightBeatmap,
	set: LightBeatmapSet,
	query: string,
): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;

	const artist = set.metadata.artist.toLowerCase();
	const title = set.metadata.title.toLowerCase();
	const creator = set.metadata.creator.toLowerCase();
	const version = beatmap.metadata.version.toLowerCase();
	const stars = beatmap.metadata.difficulty;
	const keys = beatmap.metadata.keys;
	const length = Math.floor(beatmap.metadata.total_length / 1000);

	const text = `${artist} ${title} ${creator} ${version}`;

	for (const term of q.split(/\s+/)) {
		const filter = parseFilter(term);
		if (filter) {
			if (!applyFilter(filter, {
				text, stars, keys, artist, title, creator, length, 
			}))
				return false;
		} else if (!text.includes(term)) {
			return false;
		}
	}
	return true;
}

interface Filter {
	key: string
	op: string
	value: string
}

/** Split `key<op>value` (longest operators first so `>=` beats `>`/`=`). */
function parseFilter(term: string): Filter | null {
	for (const op of ['>=', '<=', '=', ':', '>', '<']) {
		const idx = term.indexOf(op);
		if (idx > 0 && idx + op.length < term.length) {
			return {
				key: term.slice(0, idx), op, value: term.slice(idx + op.length), 
			};
		}
	}
	return null;
}

interface Ctx {
	text: string
	stars: number
	keys: number
	artist: string
	title: string
	creator: string
	length: number
}

function applyFilter(f: Filter, ctx: Ctx): boolean {
	switch (f.key) {
		case 'length':
			return numCompare(ctx.length, f.op, parseInt(f.value), true);
		case 'star':
		case 'stars':
		case 'sr':
			return numCompare(ctx.stars, f.op, parseFloat(f.value), true);
		case 'key':
		case 'keys':
		case 'cs':
			return numCompare(ctx.keys, f.op, parseFloat(f.value), false);
		case 'creator':
		case 'mapper':
			return ctx.creator.includes(f.value);
		case 'artist':
			return ctx.artist.includes(f.value);
		case 'title':
			return ctx.title.includes(f.value);
		default:
			// unknown key → treat the whole token as plain text
			return ctx.text.includes(`${f.key}${f.op}${f.value}`);
	}
}

function numCompare(
	actual: number, 
	op: string, 
	value: number, 
	stars: boolean,
): boolean {
	if (Number.isNaN(value)) return true;
	switch (op) {
		case '>': return actual > value;
		case '<': return actual < value;
		case '>=': return actual >= value;
		case '<=': return actual <= value;
		case '=':
		case ':':
			// like osu!: `stars=5` matches the whole 5.xx band; keys/etc. exact
			return stars ? Math.floor(actual) === Math.floor(value) : actual === value;
		default:
			return true;
	}
}
