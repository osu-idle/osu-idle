import Synced from '@osu-idle/shared/helpers/synced';
import {
	Skills,
	type SkillName,
} from '@osu-idle/shared/skills';
import type { SkillProgress } from '@osu-idle/shared/sim/bots/character';
import {
	Column,
	DAO,
	integer,
	real,
	table,
} from '../dao';
import type { Score } from './score';

const gainColumns = Object.fromEntries(
	Skills.map(s => [s, real().default(0)]),
) as Record<SkillName, Column<number, true>>;

const t = table('score_xp', {
	scoreId:     integer().primaryKey(),
	characterId: integer(),
	beatmapId:   integer(),
	playedAt:    integer(),
	...gainColumns,
}, {
	indexes: {
		idx_score_xp_character: 'characterId',
		idx_score_xp_beatmap:   'beatmapId',
	},
});

/** Bumped on every gain write so live views (song select indicators) re-query. */
export const xpGainsVersion = new Synced(0);

/** One play's per-skill XP gains, keyed by its local score row. */
export class ScoreXP extends DAO(t) {

	async add() {
		await super.add();
		void xpGainsVersion.set(xpGainsVersion.get() + 1);
		return this;
	}

	/** Persist a play's gains alongside its saved score. No-op when the score
	 *  never reached the local DB or the play gained nothing. */
	static async record(
		score: Score,
		gains: readonly SkillProgress[] | undefined,
	): Promise<void> {
		if (!score.id || !gains?.some(g => g.gained > 0)) return;
		const skillGains = Object.fromEntries(
			gains.filter(g => g.gained > 0).map(g => [g.skill, g.gained]),
		);
		await new ScoreXP({
			scoreId:     score.id,
			characterId: score.characterId,
			beatmapId:   score.beatmapId,
			playedAt:    score.playedAt,
			...skillGains,
		}).add();
	}

	/** The most recent play's gains per beatmap - the bulk shape the song select
	 *  indicators (and future group/sort modes) read. */
	static async latestByBeatmap(
		characterId: number,
	): Promise<Map<number, ScoreXP>> {
		const rows = await this.query(
			'SELECT * FROM score_xp WHERE characterId = ? ORDER BY playedAt ASC',
			[characterId],
		);
		const latest = new Map<number, ScoreXP>();
		for (const row of rows) latest.set(row.beatmapId, row);
		return latest;
	}
}
