import { createFileRoute } from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';
import Nomination from '../../pages/admin/Nomination';

export const Route = createFileRoute('/admin/nomination')({
	component: Nomination,
	staticData: { title: msg`beatmap nomination` },
});
