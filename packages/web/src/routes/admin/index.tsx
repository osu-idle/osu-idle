import { createFileRoute } from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';
import FAQ from '../../pages/help/FAQ';

export const Route = createFileRoute('/admin/')({
	component: FAQ,
	staticData: { title: msg`admin dashboard` },
});
