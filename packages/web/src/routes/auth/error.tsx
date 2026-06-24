import { createFileRoute } from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';
import AuthError from '../../pages/AuthError';

export const Route = createFileRoute('/auth/error')({
	component: AuthError,
	staticData: { title: msg`oh no!` },
});
