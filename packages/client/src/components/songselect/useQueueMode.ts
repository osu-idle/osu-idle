import useSynced from '@osu-idle/shared/hooks/useSynced';
import { openPage } from '../../globals';
import SceneManager, { SCENE } from '../../scenes/SceneManager';

export type QueueMode = {
	/** mounted above another scene, so it draws no scenery of its own */
	overlay: boolean;
	/** clicking a map queues it instead of playing it, and the rail is up */
	queueing: boolean;
};

/**
 * Whether song select is queueing, and whether it is doing it as an overlay.
 *
 * Managing the queue from *within* song select must not open a second song
 * select over the first: the scene already is the carousel, so it flips into
 * queue mode in place and only the rail appears. Everywhere else - gameplay,
 * the character page - there is no carousel yet, so one is mounted over the
 * scene, and that one draws none of its own scenery.
 */
export default function useQueueMode(mode: 'launch' | 'queue'): QueueMode {
	const [page] = useSynced(openPage);
	const [scene] = useSynced(SceneManager.current);
	const overlay = mode === 'queue';
	return {
		overlay,
		queueing: overlay || (scene === SCENE.SELECT && page?.page === 'queue'),
	};
}
