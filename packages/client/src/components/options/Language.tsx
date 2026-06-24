import { Trans } from '@lingui/react/macro';
import Dropdown from '../dropdown/Dropdown';
import { SETTINGS } from '../../db/settings';
import {
	SUPPORTED_LOCALES,
	LOCALE_LABELS,
	type Locale,
} from '@osu-idle/shared/i18n/locales';

const LANGUAGE_OPTIONS = SUPPORTED_LOCALES.map((locale) => ({
	value: locale as Locale,
	label: LOCALE_LABELS[locale],
}));

/** The catalog activation itself is wired globally (main.tsx subscribes to the
 *  setting), so this only owns the picker. */
export default function Language() {
	return (
		<div className="opt-row">
			<span className="opt-row__label"><Trans>Select language</Trans></span>
			<Dropdown value={SETTINGS.language} options={LANGUAGE_OPTIONS} />
		</div>
	);
}
