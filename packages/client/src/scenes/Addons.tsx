import '../components/addons/addons.css';
import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import Controls from '../input/Controls';
import Auth from '../online/auth';
import SceneManager, { SCENE } from './SceneManager';
import ManageAddonsView from '../components/addons/ManageAddonsView';
import BrowseAddonsView from '../components/addons/BrowseAddonsView';
import type { Addon } from '../online/addons';

export type AddonsView = 'manage' | 'browse';

/** What the editor is editing: a blank draft (`{}`) or an existing add-on. */
export type Editing = { addon?: Addon };

/** The add-ons scene: manage installed / authored add-ons, or browse the catalog. */
export default function Addons({ view: initial }: { view: AddonsView }) {
	const { t } = useLingui();
	const [user] = useSynced(Auth.user);
	const [view, setView] = useState<AddonsView>(initial);
	const [editing, setEditing] = useState<Editing | undefined>();

	const back = () => SceneManager.set(SCENE.MENU);
	Controls.back.usePress(back);

	const switchView = (v: AddonsView) => { setEditing(undefined); setView(v); };

	const subtitle = view === 'manage'
		? t`Manage your installed and created add-ons`
		: t`Browse the community catalogue`;

	return (
		<div className='addons'>
			<nav className='addons__tabs'>
				<button className={`addons__tab ${view === 'manage' ? 'is-active' : ''}`} onClick={() => switchView('manage')}>
					<span><Trans>Manage</Trans></span>
				</button>
				<button className={`addons__tab ${view === 'browse' ? 'is-active' : ''}`} onClick={() => switchView('browse')}>
					<span><Trans>Browse</Trans></span>
				</button>
			</nav>

			<div className='addons__header'>
				<span className='addons__title'><Trans>Add-ons</Trans></span>
				<span className='addons__subtitle'>{subtitle}</span>
			</div>

			<main className='addons__body'>
				{view === 'manage'
					? <ManageAddonsView editing={editing} setEditing={setEditing} />
					: <BrowseAddonsView />}
			</main>

			<footer className='addons__bottombar'>
				<button className='addons__baraction' onClick={back}><Trans>Back to Menu</Trans></button>
				{view === 'manage' && !editing && user && (
					<button className='addons__baraction' onClick={() => setEditing({})}><Trans>Create new add-on</Trans></button>
				)}
			</footer>
		</div>
	);
}
