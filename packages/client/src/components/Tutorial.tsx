import './Tutorial.css';
import {
	useEffect,
	type ReactNode,
} from 'react';
import Synced from '@osu-idle/shared/helpers/synced';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import Auth from '../online/auth';
import Account from '../online/account';
import SceneManager, { SCENE } from '../scenes/SceneManager';
import { SETTINGS } from '../db/settings';
import { isMobile } from '../globals';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';

const APPEAR_DELAY_MS = 1200;

interface Step {
	title: string;
	body: ReactNode;
}

/** Module-level so the wizard survives scene changes (the component itself
 *  unmounts and remounts with the overlay tree). */
const opened = new Synced(false);

/**
 * Guest onboarding wizard, opened from the main menu. Shown only while signed
 * out and until completed; the step reached is persisted in settings so a
 * returning guest resumes (or never sees it again once finished).
 */
export default function Tutorial() {
	const { t } = useLingui();
	const [user] = useSynced(Auth.user);
	const [resolved] = useSynced(Account.resolved);
	const [scene] = useSynced(SceneManager.current);
	const [step] = useSynced(SETTINGS.tutorial);
	const [isOpen] = useSynced(opened);
	

	const STEPS: Step[] = [
		{
			title: t`Welcome to osu!idle`,
			body: <Trans>
				This is an <b>automated, idle</b> osu!mania stable client:
				your character plays the maps on its own and progresses with every play.
			</Trans>,
		},
		{
			title: t`Play online`,
			body: <Trans>
				osu!idle features <b>online leaderboards</b>, just like osu!.
				Sign in with your osu! account to compete and save your progression online.
			</Trans>,
		},
		{
			title: t`Pick a song`,
			body: isMobile ? <Trans>
				Bundled maps are listed in <b>song select</b>:
				<b> double-click</b> a map to download it, then <b>single-click</b> to start playing.
			</Trans> : <Trans>
				Bundled maps are listed in <b>song select</b>:
				<b> double-tap</b> a map to download it, then <b>single-tap</b> to start playing.
			</Trans>,
		},
		{
			title: t`Level up`,
			body: <Trans>
				Each completed play earns your character <b>XP</b> and <b>levels</b> across
				various skillsets, making it perform better on future plays.
			</Trans>,
		},
		{
			title: t`Playlists`,
			body: isMobile ? <Trans>
				Your character can play <b>on-repeat</b>, automatically, on playlists you crafted.
				<b> Righ-click</b> a beatmap to add it and <b>group by playlist</b>, then start a beatmap to enter playlist mode.
			</Trans> : <Trans>
				Your character can play <b>on-repeat</b>, automatically, on playlists you crafted.
				<b> Hold down</b> a beatmap to add it and <b>group by playlist</b>, then start a beatmap to enter playlist mode.
			</Trans>,
		},
		{
			title: t`Early alpha`,
			body: <Trans>
				osu!idle is in <b>alpha</b> and under active development - if you hit a bug,
				report it on <a 
					href="https://discord.gg/Yd5GEaX8AJ"
					target="_blank"
					rel="noreferrer"
				>discord</a>. Have fun!
			</Trans>,
		},
	];

	// The guest-on-the-menu check only gates the *appearance*: once open, the
	// wizard stays - through a sign-in from its own button and across scene
	// changes - until finished or skipped. Waiting for the session to resolve
	// keeps a signed-in player booting up from being flashed the tutorial
	// mid-validation, and the delay lets the menu's entrance (flash, logo pop,
	// music) settle first.
	useEffect(() => {
		if (isOpen 
			|| !resolved 
			|| user 
			|| scene !== SCENE.MENU 
			|| step >= STEPS.length
		) return;

		const t = setTimeout(() => void opened.set(true), APPEAR_DELAY_MS);
		return () => clearTimeout(t);
	}, [isOpen, resolved, user, scene, step]);

	if (!isOpen || step >= STEPS.length) return null;

	const current = STEPS[step];
	const last = step === STEPS.length - 1;
	const goTo = (s: number) => void SETTINGS.tutorial.set(s);

	const signIn = () => Auth.signIn();

	return (
		<div className="tutorial">
			<div className="tutorial__card">
				<h1 className="tutorial__title">{current.title}</h1>
				<p className="tutorial__body">{current.body}</p>

				<div className="tutorial__dots">
					{STEPS.map((_, i) => (
						<span 
							key={i} 
							className={`tutorial__dot ${i === step ? 'tutorial__dot--active' : ''}`} 
						/>
					))}
				</div>

				<div className="tutorial__actions">
					<button className="tutorial__skip" onClick={() => goTo(STEPS.length)}>
						<Trans>Skip</Trans>
					</button>
					{step > 0 && (
						<button className="tutorial__btn" onClick={() => goTo(step - 1)}>
							<Trans>Back</Trans>
						</button>
					)}
					{step === 1 && (
						<button className="tutorial__btn" onClick={() => void signIn()}>
							<Trans>Sign in</Trans>
						</button>
					)}
					<button 
						className="tutorial__btn tutorial__btn--primary" 
						onClick={() => goTo(step + 1)}
					>
						{last ? t`Got it!` : t`Next`}
					</button>
				</div>
			</div>
		</div>
	);
}
