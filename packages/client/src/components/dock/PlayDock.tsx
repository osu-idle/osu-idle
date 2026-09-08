import { useState } from 'react';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import PlayManager from '../../online/playManager';
import PlayQueue from '../../gameplay/playQueue';
import SceneManager, { SCENE } from '../../scenes/SceneManager';
import { openPage } from '../../globals';
import DockPanel from './DockPanel';
import DockPill from './DockPill';
import './dock.css';

/**
 * The app-level dock: the one place that says what the character is playing and
 * what it plays next, from any scene. Collapsed to a pill over gameplay (the
 * play is already on screen there), open everywhere else.
 */
export default function PlayDock() {
	const [live] = useSynced(PlayManager.live);
	const [queue] = useSynced(PlayQueue.state);
	const [scene] = useSynced(SceneManager.current);
	const [page] = useSynced(openPage);
	const [expanded, setExpanded] = useState(false);

	// the intro and the main menu are the game's front door - nothing docks there
	if (scene === SCENE.INTRO || scene === SCENE.MENU) return null;

	// while the carousel is open for queueing, the dock moves into the column it
	// leaves empty and stays open - it is the queue, and there is only one of it.
	// In song select the carousel is the scene itself, which keeps its bottom bar.
	if (page?.page === 'queue') {
		return <DockPanel left inScene={scene === SCENE.SELECT} />;
	}

	// song select's bottom bar would clip it; everywhere else it sits low
	const aboveBar = scene === SCENE.SELECT;

	// In song select it is always up, empty or not: it is the way to the
	// character page from here, now that the bottom bar has no button for it.
	// Elsewhere it appears only when there is something to say.
	if (!live && !queue && scene !== SCENE.SELECT) return null;

	if (scene === SCENE.GAME && !expanded) {
		return <DockPill onExpand={() => setExpanded(true)} aboveBar={aboveBar} />;
	}
	return (
		<DockPanel
			onCollapse={scene === SCENE.GAME ? () => setExpanded(false) : undefined}
			aboveBar={aboveBar}
		/>
	);
}
