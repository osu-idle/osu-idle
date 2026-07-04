import { t } from '@lingui/core/macro';
import Synced from '@osu-idle/shared/helpers/synced';
import type { ChatLine } from '@osu-idle/shared/community/wire';
import type { SkillProgress } from '@osu-idle/shared/sim/bots/character';
import type { Grade } from '@osu-idle/shared/judgement';
import { skillName } from '@osu-idle/shared/display/skills';
import num from '@osu-idle/shared/display/num';
import type LightBeatmap from './osu/beatmap/LightBeatmap';
import Entities from './entity/entities';

/** The client-only chat channel: written by code, never touches the wire. */
export const LOGS_CHANNEL = '#logs';

const LOG_COLOR = '#58a0ec';

export const logLines = new Synced<ChatLine[]>([]);

export const log = (text: string, color = LOG_COLOR, at = Date.now()): void => {
	const line: ChatLine = {
		id: crypto.randomUUID(),
		kind: 'system',
		channel: LOGS_CHANNEL,
		text,
		color,
		at,
	};
	void logLines.set([...logLines.get(), line]);
};

const gainsSummary = (progression?: SkillProgress[]): string => {
	const gains = (progression ?? [])
		.filter(g => g.gained > 0)
		.sort((a, b) => b.gained - a.gained)
		.map(g => `+${num(Math.round(g.gained))} ${skillName(g.skill)}`
			+ (g.toLevel > g.fromLevel ? ` (lv${g.fromLevel} to lv${g.toLevel})` : ''));
	return gains.length ? gains.join(', ') : t`No XP gained.`;
};

/** One #logs line per finished play: who, what map, result, XP breakdown. */
export const logPlayFinished = (
	score: { accuracy: number; grade: Grade; playedAt: number },
	beatmap: LightBeatmap,
	progression?: SkillProgress[],
): void => {
	const name = Entities.character.get()?.name ?? t`Guest`;
	const meta = beatmap.set.metadata;
	const map = `${meta.artist} - ${meta.title} [${beatmap.metadata.version}]`;
	const accuracy = `${(score.accuracy * 100).toFixed(2)}%`;
	const grade = score.grade;
	const gains = gainsSummary(progression);
	log(
		t`${name} played ${map} and got a ${accuracy} ${grade}. ${gains}`,
		LOG_COLOR,
		score.playedAt,
	);
};
