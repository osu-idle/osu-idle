import { Trans } from '@lingui/react/macro';

export default function AuthError() {
	return (
		<main className="page-contents">
			<div className="card">
				<h1 className="card__title"><Trans>Error</Trans></h1>
				<p className="card__sub"><Trans>An error occurred when communicating with osu! ... if your osu! account is valid, please try again</Trans></p>
			</div>
		</main>
	);
}
