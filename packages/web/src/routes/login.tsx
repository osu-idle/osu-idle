import { createFileRoute } from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';
import Login from '../pages/Login';

export const Route = createFileRoute('/login')({
	component: Login,
	staticData: { title: msg`login` },
});
