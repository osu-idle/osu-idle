import { createFileRoute } from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';
import AuthCallback from '../../pages/AuthCallback';

export const Route = createFileRoute('/auth/callback')({
	component: AuthCallback,
	staticData: { title: msg`hi !` },
});
