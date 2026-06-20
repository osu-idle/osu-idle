import './PlayOsuIdle.css';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import Link from '../components/Link';
import { detectPlatform, fetchManifest, PLATFORM_LABEL, resolveDownload } from '../download';
import { Trans } from '@lingui/react/macro';

/**
 * The "Play osu!idle" entry point: choose between playing in the browser or
 * downloading the desktop app (which runs the same game without a browser's
 * background-tab throttling). The download link + version come from the deploy's
 * publish manifest, so they always point at the latest build.
 */
export default function PlayOsuIdle() {
	const platform = detectPlatform();
	const manifest = useAsync(fetchManifest, []);
	const { version, primary, alternatives } = resolveDownload(manifest ?? null, platform);

	return (
		<main className="playosu">
			<h2 className="playosu__lead"><Trans>How do you want to play?</Trans></h2>

			<div className="playosu__choices">
				<section className="playosu__card">
					<h3 className="playosu__card-title"><Trans>Play in the browser</Trans></h3>
					<p className="playosu__card-text"><Trans>Simplest, nothing to install.</Trans></p>
					<Link to=":play" className="cta-button playosu__cta"><span><Trans>Play now</Trans></span></Link>
				</section>

				<section className="playosu__card playosu__card--featured">
					<h3 className="playosu__card-title"><Trans>Download the desktop app</Trans></h3>
					<p className="playosu__card-text">
						<Trans>Best for performance and idling.</Trans>
					</p>
					{primary
						? <a className="cta-button playosu__cta" href={primary.href} download>
							<span><Trans>Download for {primary.label} (v{version})</Trans></span>
						</a>
						: <span className="cta-button playosu__cta playosu__cta--disabled">
							<span><Trans>Not yet available for {PLATFORM_LABEL[platform]}</Trans></span>
						</span>}

					{alternatives.length > 0 && (
						<div className="playosu__alt">
							<span><Trans>Other platforms:</Trans></span>
							{alternatives.map(alt => (
								<a key={alt.platform} href={alt.href} download>{alt.label}</a>
							))}
						</div>
					)}
				</section>
			</div>
		</main>
	);
}
