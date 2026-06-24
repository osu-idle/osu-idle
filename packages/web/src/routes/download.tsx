import { createFileRoute } from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';
import PlayOsuIdle from '../pages/PlayOsuIdle';

export const Route = createFileRoute('/download')({
	component: PlayOsuIdle,
	staticData: { title: msg`play osu!idle` },
});
