import './Footer.css';
import { VERSION } from '@osu-idle/shared/version';
import { Trans } from '@lingui/react/macro';

export default function Footer() {

	return (<footer>
		<div className='footer__links'>
			<a><Trans>Rules</Trans></a>
			<a><Trans>Terms</Trans></a>
			<a><Trans>Privacy</Trans></a>
			<a><Trans>Server Status</Trans></a>
			<a href="https://github.com/osu-idle/osu-idle"><Trans>Source code</Trans></a>
			<a><Trans>Contact</Trans></a>
		</div>
		<div className='footer__credits'>v{VERSION} | adri powered {`2026${(new Date().getFullYear() !== 2026) ? `-${new Date().getFullYear()}` : ''}`}</div>
	</footer>);
}
