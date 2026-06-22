import useSynced from '@osu-idle/shared/hooks/useSynced';
import Header from './Header';
import { useAuthLoaded, useCurrentUser } from './hooks/useCurrentUser';
import Page from './Page';
import PublicLanding from './pages/PublicLanding';
import { Path, ROUTE, useRoute } from './router';
import { pageTitle } from './globals';
import Blackout from './components/Blackout';
import Footer from './Footer';
import { useLingui } from '@lingui/react/macro';

export default function App() {
	const { t } = useLingui();

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
	
	const TITLE = {
		[ROUTE.LANDING]: t`dashboard`,
		[ROUTE.HOME]: t`dashboard`,
		[ROUTE.NEWS]: t`news`,
		[ROUTE.NEWS_ADMIN]: t`manage news`,
		[ROUTE.DOWNLOAD]: t`play osu!idle`,

		[ROUTE.LOGIN]: t`login`,
		[ROUTE.LOGOUT]: t`logging out...`,
	
		[ROUTE.BEATMAP_LISTING]: t`beatmap listing`,

		[ROUTE.RANKINGS_GLOBAL]: t`rankings`,
		[ROUTE.RANKINGS_GLOBAL_SCORE]: t`rankings`,
		[ROUTE.RANKINGS_GLOBAL_COUNTRY]: t`rankings`,
		[ROUTE.RANKINGS_GLOBAL_SCORE_COUNTRY]: t`rankings`,
		[ROUTE.RANKINGS_COUNTRY]: t`rankings`,
		[ROUTE.RANKINGS_PLAYS]: t`rankings`,
		[ROUTE.RANKINGS_SKILLS]: t`rankings`,
		[ROUTE.RANKINGS_SKILLS_COUNTRY]: t`rankings`,
		[ROUTE.RANKINGS_GRADES]: t`rankings`,
		[ROUTE.RANKINGS_GRADES_COUNTRY]: t`rankings`,

		[ROUTE.NEWS_ARTICLE]: t`news`,
		[ROUTE.CHARACTER_PAGE]: t`character info`,

		[ROUTE.HELP_FAQ]: t`FAQ`,

		[ROUTE.AUTH_CALLBACK]: t`hi !`,
		[ROUTE.AUTH_DESKTOP]: t`signed in`,
		[ROUTE.AUTH_ERROR]: t`oh no!`,

		[ROUTE.ADMIN_BALANCING]: t`balancing`,
		[ROUTE.ADMIN_NOMINATION]: t`beatmap nomination`,
		[ROUTE.ADMIN_ADDONS]: t`add-ons`,
	} as const satisfies {[key in Path]: string};

	const displayTitle = title !== '' ? title : TITLE[route] ?? t`dashboard`;

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
