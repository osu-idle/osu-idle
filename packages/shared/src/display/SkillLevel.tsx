import {
	useState,
	type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { effectiveLevelOf } from '../sim/skills/levelCurve.js';
import {
	levelFromTotalXp,
	levelFromXp,
	levelNode,
} from './levelDisplay.js';

const card: CSSProperties = {
	position: 'fixed',
	display: 'flex',
	flexDirection: 'column',
	// above the client's page overlay (5000), which the upgrades panel opens in
	zIndex: 5200,
	pointerEvents: 'none',
	padding: '0.4rem 0.6rem',
	borderRadius: 6,
	background: 'rgba(0, 0, 0, 0.85)',
	border: '1px solid rgba(255, 255, 255, 0.1)',
	boxShadow: '0 6px 18px rgba(0, 0, 0, 0.5)',
	fontSize: '0.75rem',
	fontWeight: 400,
	lineHeight: 1.6,
	whiteSpace: 'nowrap',
	textAlign: 'left',
};

/** Gap between the level and its card. */
const GAP_PX = 6;
/** Room needed above the level before the card is flipped under it. */
const FLIP_BELOW_PX = 120;

const row: CSSProperties = {
	display: 'flex',
	justifyContent: 'space-between',
	gap: '0.75rem',
};
// only the labels are dimmed: the values keep the level colours
const label: CSSProperties = { color: 'rgba(255, 255, 255, 0.55)' };

/**
 * The level a character is shown at: their xp level plus prestige bonus levels.
 * Hovering breaks it back into the parts it was built from.
 *
 * The level -> skill mapping is deliberately absent: it belongs to the strain
 * curves, and the player is shown real levels.
 */
export default function SkillLevel({
	level,
	xp,
	prestige = 0,
	lifetimeXp,
}: {
	level: number,
	xp: number,
	prestige?: number,
	/** xp ever earned on the skill, shown as the level it would be worth */
	lifetimeXp?: number,
}) {
	// the anchor's box, captured on hover: the card is portalled to the body so
	// a leaderboard's scroll container cannot clip it, which means it has to be
	// placed by hand rather than relative to the level
	const [at, setAt] = useState<DOMRect | undefined>(undefined);

	const shown = effectiveLevelOf(level, xp, prestige);
	// flipped under the level when there is no room for it above
	const below = at !== undefined && at.top < FLIP_BELOW_PX;

	return <span
		onMouseEnter={e => setAt(e.currentTarget.getBoundingClientRect())}
		onMouseLeave={() => setAt(undefined)}
	>
		{levelNode(shown, shown - Math.floor(shown))}
		{at !== undefined && typeof document !== 'undefined' && createPortal(
			<span style={{
				...card,
				left: at.left + at.width / 2,
				top: below ? at.bottom + GAP_PX : at.top - GAP_PX,
				transform: `translate(-50%, ${below ? '0' : '-100%'})`,
			}}>
				<span style={row}>
					<span style={label}>XP level</span>
					{levelFromXp(level, xp)}
				</span>
				{prestige > 0 && (
					<span style={row}><span style={label}>Prestige</span><span>+{prestige}</span></span>
				)}
				{!!lifetimeXp && (
					<span style={row}>
						<span style={label}>Lifetime</span>
						{levelFromTotalXp(lifetimeXp)}
					</span>
				)}
			</span>,
			document.body,
		)}
	</span>;
}
