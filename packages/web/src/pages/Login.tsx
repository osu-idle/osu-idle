import { Trans } from '@lingui/react/macro';
import { loginWithOsu } from '../auth';

export default function Login() {
	return (<>
		<main className="page-contents">
			<div className="page-text">
				<h1 className="center"><Trans>Sign in</Trans></h1>
				<p className="center"><Trans>Connect your osu! account to appear in the leaderboards.</Trans></p>
				<div className='center' style={{ marginTop: '30px' }}>
					<a onClick={loginWithOsu} className='cta-button'>
						<span><Trans>Sign in with osu!</Trans></span>
					</a>
				</div>
			</div>
		</main>
	</>);
}
