import './FormerNames.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClockRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { useLingui } from '@lingui/react/macro';

/** osu!-style previous usernames hint shown after a character's name: a small
 *  history icon whose tooltip lists every former name. */
export default function FormerNames({ names }: { names: string[] }) {
	const { t } = useLingui();
	if (!names.length) return null;
	return (
		<span
			className="former-names"
			title={t`formerly known as ${names.join(', ')}`}
		>
			<FontAwesomeIcon icon={faClockRotateLeft} />
		</span>
	);
}
