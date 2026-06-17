import { ScoreDTO } from '@osu-idle/shared/score';
import { boolean, Column, DAO, DB, integer, real, table, text } from '../dao';
import { ScoreBest } from './score_best';
import { ScoreBestPP } from './score_best_pp';
import { Grade, Judgement, Judgements } from '@osu-idle/shared/judgement';

const judgementColumns = Object.fromEntries(
	Judgements.map(j => [j, integer()]),
) as Record<Judgement, Column<number>>;

const t = table('score', {
	id:          integer().primaryKey().autoincrement(),
	onlineId:    integer().default(-1),
	characterId: integer(),
	beatmapId:   integer(),
	score:       integer(),
	accuracy:    real(),
	maxCombo:    integer(),
	...judgementColumns,
	grade:       text<Grade>(),
	pp:          real(),
	ur:          real(),
	pfc:         boolean(),
	playedAt:    integer(),
}, {
	indexes: {
		idx_score_online_id: 'onlineId',
		idx_score_beatmap:   'beatmapId',
		idx_score_character: 'characterId',
		idx_score_value:     'score DESC',
		idx_score_pp:        'pp DESC',
	},
});

export class Score extends DAO(t) {

	async add() {
		await super.add();

		const currentBest = await Score.best(this.characterId, this.beatmapId);

		if (!currentBest || this.isHigherThan(currentBest)) {
			await ScoreBest.fromScore(this).add();
		}

		const currentBestPP = await Score.bestPP(this.characterId, this.beatmapId);

		if (!currentBestPP || this.hasHigherPPThan(currentBestPP)) {
			await ScoreBestPP.fromScore(this).add();
		}

		return this;	
	}

	public isHigherThan(score: Score): boolean {
		return this.score > score.score;
	}

	public hasHigherPPThan(score: Score): boolean {
		return this.pp > score.pp;
	}

	static fromDTO(dto: ScoreDTO): Score {
		const { judgements, ...rest } = dto;
		return new Score({ ...rest, ...judgements, onlineId: dto.id, id: undefined });
	}

	/** Serialise this row to the shared wire DTO (e.g. to submit to the API).
	 *  Values are sanitised - old local rows can carry NaN pp/ur or fractional
	 *  scores, which the strict wire schema (ints, finite, 0..1 accuracy) rejects. */
	toDTO(): ScoreDTO {
		const int = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);
		const nonNeg = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
		return {
			id:          int(-1),
			characterId: Math.max(1, int(this.characterId)),
			beatmapId:   int(this.beatmapId),
			score:       int(this.score),
			accuracy:    Math.min(1, Number.isFinite(this.accuracy) ? Math.max(0, this.accuracy) : 0),
			maxCombo:    int(this.maxCombo),
			judgements:  Object.fromEntries(
				Judgements.map(j => [j, int(this[j])]),
			) as Record<Judgement, number>,
			grade:       this.grade,
			pp:          nonNeg(this.pp),
			ur:          nonNeg(this.ur),
			pfc:         this.pfc,
			playedAt:    int(this.playedAt),
		};
	}

	static getByOnlineId(onlineId: number): Promise<Score | undefined> {
		return this.first(
			`SELECT * FROM score WHERE onlineId = ?`,
			[onlineId],
		);
	}

	static best(characterId: number, beatmapId: number): Promise<Score | undefined> {
		return this.first(
			`SELECT s.* FROM score s
				JOIN score_best b ON b.scoreId = s.id
				WHERE b.characterId = ? AND b.beatmapId = ?`,
			[characterId, beatmapId],
		);
	}

	static bestPP(characterId: number, beatmapId: number): Promise<Score | undefined> {
		return this.first(
			`SELECT s.* FROM score s
				JOIN score_best_pp b ON b.scoreId = s.id
				WHERE b.characterId = ? AND b.beatmapId = ?`,
			[characterId, beatmapId],
		);
	}

	static recent(characterId: number, limit = 50): Promise<Score[]> {
		return this.query(
			`SELECT * FROM score WHERE characterId = ? ORDER BY playedAt DESC LIMIT ?`,
			[characterId, limit],
		);
	}

	static forBeatmap(beatmapId: number, limit = 50): Promise<Score[]> {
		return this.query(
			`SELECT * FROM score WHERE beatmapId = ? ORDER BY score DESC, playedAt DESC LIMIT ?`,
			[beatmapId, limit],
		);
	}

	/** How many times this character has played this map locally - drives the
	 *  memory skill for guest / unranked plays (ranked uses the server count). */
	static countPlays(characterId: number, beatmapId: number): Promise<number> {
		return DB.read(db => {
			const res = db.exec(
				`SELECT COUNT(*) AS n FROM score WHERE characterId = ? AND beatmapId = ?`,
				[characterId, beatmapId],
			);
			return (res[0]?.values[0][0] as number) ?? 0;
		});
	}
}