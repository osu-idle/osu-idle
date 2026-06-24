import {
	createFileRoute,
	lazyRouteComponent,
} from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';

// Admin-only and the sole consumer of plotly (~4.7MB). Lazy-loaded so plotly
// lands in its own chunk fetched only when an admin opens this page, instead of
// bloating the bundle every visitor downloads.
export const Route = createFileRoute('/admin/balancing')({
	component: lazyRouteComponent(() => import('../../pages/admin/Balancing')),
	staticData: { title: msg`balancing` },
});
