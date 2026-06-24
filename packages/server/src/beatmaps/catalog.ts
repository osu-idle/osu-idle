import {
	and,
	eq,
	lte,
	sql,
} from 'drizzle-orm';
import { INTRO_SET_ID } from '@osu-idle/shared/beatmap';
import { db } from '../db/client';
import { beatmaps } from '../db/schema/beatmap';
import { beatmapset } from '../db/schema/beatmapset';

/** A set is live - listed, downloadable, previewable - only once it's ranked and
 *  its scheduled rank time has passed. Pending (null rankedAt) and future-dated
 *  sets are excluded (null <= now() is null, so they drop out). Reused by the
 *  public listing routes so the whole site shares one definition of "live". */
export const liveCondition = and(
	eq(beatmapset.status, 'ranked'), 
	lte(beatmapset.rankedAt, sql`now()`),
);

const previewUrl = (setId: number, file: string | null) =>
	file ? `/v1/beatmap/preview/${setId}/${file}` : undefined;

/** Whether a single set is live, for gating the .osz + preview file routes. */
export const isSetLive = async (setId: number): Promise<boolean> => {
	const [row] = await db
		.select({ id: beatmapset.id })
		.from(beatmapset)
		.where(and(eq(beatmapset.id, setId), liveCondition))
		.limit(1);
	return !!row;
};

// `runtime: false` marks a catalog entry the client hasn't downloaded yet, as
// opposed to its local runtime store of downloaded sets.
type CatalogVersion = {
	id: number;
	runtime: false;
	version: string;
	difficulty: number;
	mode: number;
	keys: number;
	audio?: string;
	background?: string;
	total_length: number;
	bpm: number;
	objects: number;
	rice: number;
	ln: number;
};

type CatalogSet = {
	id: number;
	runtime: false;
	title: string;
	artist: string;
	creator: string;
	background?: string;
	audio?: string;
	versions: CatalogVersion[];
};

export type Catalog = {
	intro?: CatalogSet;
	beatmaps: CatalogSet[];
};

/** The live catalog: every ranked-and-due set with its difficulties, plus the
 *  intro set called out separately. Replaces the old static manifest.json. */
export const buildCatalog = async (): Promise<Catalog> => {
	const rows = await db
		.select({
			setId: beatmapset.id,
			artist: beatmapset.artist,
			title: beatmapset.title,
			creator: beatmapset.creator,
			b: beatmaps,
		})
		.from(beatmapset)
		.innerJoin(beatmaps, eq(beatmapset.id, beatmaps.setId))
		.where(liveCondition);

	const sets = new Map<number, CatalogSet>();
	for (const row of rows) {
		let set = sets.get(row.setId);
		if (!set) {
			set = {
				id: row.setId,
				runtime: false,
				title: row.title,
				artist: row.artist,
				creator: row.creator,
				versions: [],
			};
			sets.set(row.setId, set);
		}

		const audio = previewUrl(row.setId, row.b.audio);
		const background = previewUrl(row.setId, row.b.background);

		set.versions.push({
			id: row.b.id,
			runtime: false,
			version: row.b.version,
			difficulty: Math.round(Number(row.b.sr) * 100) / 100,
			mode: row.b.mode,
			keys: row.b.keys,
			audio,
			background,
			total_length: row.b.total_length,
			bpm: row.b.bpm,
			objects: row.b.objects,
			rice: row.b.rice,
			ln: row.b.ln,
		});

		set.audio ??= audio;
		set.background ??= background;
	}

	return {
		intro: sets.get(INTRO_SET_ID), beatmaps: [...sets.values()], 
	};
};
