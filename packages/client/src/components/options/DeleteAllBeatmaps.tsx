import { useRef, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import Log from '@osu-idle/shared/helpers/log';
import Button from './controls/Button';
import BeatmapStore from '../../osu/beatmap/beatmap_store';

/** How long the "are you sure" arming lasts before reverting. */
const CONFIRM_MS = 3000;

export default function DeleteAllBeatmaps() {
	const { t } = useLingui();
	const [armed, setArmed] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const click = () => {
		if (!armed) {
			setArmed(true);
			timer.current = setTimeout(() => setArmed(false), CONFIRM_MS);
			return;
		}
		clearTimeout(timer.current);
		setArmed(false);
		void BeatmapStore.deleteAll()
			.then(() => Log.popup(t`All beatmaps deleted.`))
			.catch((e) => Log.errorPopup(String(e)));
	};

	return (
		<Button
			accent="#d64045"
			onClick={click}
			label={armed ? <Trans>Click again to confirm</Trans> : <Trans>Delete all beatmaps</Trans>}
		/>
	);
}
