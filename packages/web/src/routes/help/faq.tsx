import { createFileRoute } from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';
import FAQ from '../../pages/help/FAQ';

export const Route = createFileRoute('/help/faq')({
	component: FAQ,
	staticData: { title: msg`FAQ` },
});
