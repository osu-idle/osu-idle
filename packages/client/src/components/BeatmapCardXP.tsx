import {
	useRef,
	useState,
} from 'react';
import { bignum } from '@osu-idle/shared/display/num';
import { skillName } from '@osu-idle/shared/display/skills';
import type { BeatmapXPInsight } from '../xpInsights';
import BeatmapXPBreakdown from './BeatmapXPBreakdown';
import { Trans } from '@lingui/react/macro';

/** The card's XP section, top-right: the main skill trained on the last play
 *  and the total gained. Hover (mouse) or tap (touch) opens the per-skill
 *  breakdown; presses on the section never reach the card, so opening it can't
 *  select or launch the map. */
export default function BeatmapCardXP({ insight }: {
	insight?: BeatmapXPInsight,
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [anchor, setAnchor] = useState<DOMRect>();

	if (!insight) return null;

	const open = () => setAnchor(ref.current?.getBoundingClientRect());
	const close = () => setAnchor(undefined);

	return (
		<div
			ref={ref}
			className="bm-card__xp"
			onPointerEnter={(e) => { if (e.pointerType === 'mouse') open(); }}
			onPointerLeave={(e) => { if (e.pointerType === 'mouse') close(); }}
			onPointerUp={(e) => {
				if (e.pointerType === 'mouse') return;
				if (anchor) close();
				else open();
			}}
			onClick={(e) => e.stopPropagation()}
		>
			{insight.top && (
				<span className="bm-card__xp-chip bm-card__xp-skill">
					{skillName(insight.top.skill)}
					<em>{bignum(insight.top.gained)}xp</em>
				</span>
			)}
			<span className="bm-card__xp-chip bm-card__xp-total">
				<Trans>Total {bignum(insight.total)}xp</Trans>
			</span>
			{anchor && (
				<BeatmapXPBreakdown insight={insight} anchor={anchor} onClose={close} />
			)}
		</div>
	);
}
