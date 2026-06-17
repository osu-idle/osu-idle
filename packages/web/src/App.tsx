import useSynced from '@osu-idle/shared/hooks/useSynced';
import Header from './Header';
import { useAuthLoaded, useCurrentUser } from './hooks/useCurrentUser';
import Page from './Page';
import PublicLanding from './pages/PublicLanding';
import { Path, ROUTE, useRoute } from './router';
import { pageTitle } from './globals';
import Blackout from './components/Blackout';
import Footer from './Footer';

const TITLE = {
	[ROUTE.LANDING]: 'dashboard',
	[ROUTE.HOME]: 'dashboard',
	[ROUTE.NEWS]: 'news',
	[ROUTE.NEWS_ADMIN]: 'manage news',
	[ROUTE.PLAY_OSU]: 'osu!',

	[ROUTE.LOGIN]: 'login',
	[ROUTE.LOGOUT]: 'logging out...',
	
	[ROUTE.BEATMAP_LISTING]: 'beatmap listing',

	[ROUTE.RANKINGS_GLOBAL]: 'rankings',
	[ROUTE.RANKINGS_GLOBAL_SCORE]: 'rankings',
	[ROUTE.RANKINGS_GLOBAL_COUNTRY]: 'rankings',
	[ROUTE.RANKINGS_GLOBAL_SCORE_COUNTRY]: 'rankings',
	[ROUTE.RANKINGS_COUNTRY]: 'rankings',
	[ROUTE.RANKINGS_PLAYS]: 'rankings',
	[ROUTE.RANKINGS_SKILLS]: 'rankings',
	[ROUTE.RANKINGS_SKILLS_COUNTRY]: 'rankings',

	[ROUTE.NEWS_ARTICLE]: 'news',
	[ROUTE.CHARACTER_PAGE]: 'character info',

	[ROUTE.HELP_FAQ]: 'FAQ',

	[ROUTE.AUTH_CALLBACK]: 'hi !',
	[ROUTE.AUTH_ERROR]: 'oh no!',

	[ROUTE.ADMIN_BALANCING]: 'balancing',
} as const satisfies {[key in Path]: string};

export default function App() {
	const route = useRoute();
	const user = useCurrentUser();
	const authLoaded = useAuthLoaded();
	const [title] = useSynced(pageTitle);
	const onLandingRoute = route === ROUTE.LANDING || route === ROUTE.HOME;

	// On the landing/home route the signed-out vs signed-in UI diverge entirely;
	// wait for the session to resolve so we don't flash the public landing to a
	// signed-in user (their cookie just hasn't been checked yet).
	if (onLandingRoute && !authLoaded) return null;

	const publicLanding = !user && onLandingRoute;

	const displayTitle = title !== '' ? title : TITLE[route] ?? 'dashboard';

	return (<>
		{publicLanding && <PublicLanding />}
		{!publicLanding && (<>
			<Blackout />
			<Header />
			<div className='page'>
				<h1 className='page-title'>{displayTitle}</h1>
				<Page />
			</div>
			<Footer />
		</>)}
	</>);
}
