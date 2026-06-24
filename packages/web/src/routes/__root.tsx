import {
	createRootRoute,
	Outlet,
	useRouterState,
} from '@tanstack/react-router';
import { useLingui } from '@lingui/react';
import { msg } from '@lingui/core/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import Header from '../Header';
import Footer from '../Footer';
import Blackout from '../components/Blackout';
import RouteProgress from '../components/RouteProgress';
import PublicLanding from '../pages/PublicLanding';
import {
	useAuthLoaded,
	useCurrentUser,
} from '../hooks/useCurrentUser';
import { pageTitle } from '../globals';

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
	const { i18n } = useLingui();
	const user = useCurrentUser();
	const authLoaded = useAuthLoaded();
	const [override] = useSynced(pageTitle);

	const matches = useRouterState({ select: s => s.matches });
	const leaf = matches[matches.length - 1];
	const onIndex = leaf?.routeId === '/';

	// On the index the signed-out vs signed-in UI diverge entirely; wait for the
	// session so we don't flash the public landing to a signed-in user.
	if (onIndex && !authLoaded) return null;
	if (onIndex && !user) return <PublicLanding />;

	const titleMsg = [...matches].reverse().find(m => m.staticData.title)?.staticData.title;
	const title = override !== '' ? override : i18n._(titleMsg ?? msg`dashboard`);

	return (<>
		<RouteProgress />
		<Blackout />
		<Header />
		<div className='page'>
			<h1 className='page-title'>{title}</h1>
			<Outlet />
		</div>
		<Footer />
	</>);
}
