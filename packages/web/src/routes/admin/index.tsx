import { createFileRoute } from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';
import Dashboard from '../../pages/admin/Dashboard';

export const Route = createFileRoute('/admin/')({
	component: Dashboard,
	staticData: { title: msg`admin dashboard` },
});
