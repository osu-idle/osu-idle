import './WorldMap.css';
import { useLingui } from '@lingui/react/macro';
import type { PresenceEntry } from '@osu-idle/shared/community/presence';
import { WORLD_COUNTRIES } from './worldCountries';
import normalize from '@osu-idle/shared/math/normalize';

// Plate carree is 360x180 (lat 90..-90). We crop the bottom band - most of
// Antarctica - so the inhabited world fills the frame; a dot's vertical
// position is remapped by the same factor, and anyone below the crop falls
// off-frame (clipped). 150 -> latitudes 90..-60.
const FULL_HEIGHT = 180;
const VIEW_HEIGHT = 150;

/**
 * osu!stable's world map: country outlines with a pink square per unique player
 * location. Coordinates are the coarse, anonymous points the server projects
 * (see server `geo.ts`); we dedupe so a cell with many players is one square
 * whose opacity stacks (25% per player, full at 4+). The map is an inline SVG
 * (same plate-carree projection as the dots) so the land/border colours are
 * CSS-driven.
 */
export default function WorldMap({ characters }: { characters: PresenceEntry[] }) {
	const { t } = useLingui();

	const points = new Map<string, number>();
	for (const c of characters) {
		if (!c.loc) continue;
		const key = `${c.loc.x},${c.loc.y}`;
		points.set(key, (points.get(key) ?? 0) + 1);
	}

	return (
		<div className="community-map">
			<svg
				className="community-map__svg"
				viewBox={`0 0 360 ${VIEW_HEIGHT}`}
				preserveAspectRatio="none"
			>
				{WORLD_COUNTRIES.map((d, i) => <path key={i} d={d} />)}
			</svg>
			{[...points.entries()].map(([key, count]) => {
				const [x, y] = key.split(',').map(Number);
				return (
					<span
						key={key}
						className="community-map__dot"
						style={{
							left: `${x * 100}%`,
							top: `${(y * FULL_HEIGHT / VIEW_HEIGHT) * 100}%`,
							opacity: 0.4 + normalize(count, [0,4]) * 0.6,
						}}
						title={t`${count} here`}
					/>
				);
			})}
			{points.size === 0 && <div className="community-empty">{t`No locations to show`}</div>}
		</div>
	);
}
