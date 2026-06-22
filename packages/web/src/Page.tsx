import { ComponentType, lazy, Suspense } from 'react';
import { PageProps, Path, ROUTE, useMatch } from './router';
import Home from './pages/Home';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import GlobalRankings from './pages/rankings/Global';
import CountryRankings from './pages/rankings/Country';
import News from './pages/news/News';
import NewsArticle from './pages/news/NewsArticle';
import NewsAdmin from './pages/news/NewsAdmin';
import PlayOsuIdle from './pages/PlayOsuIdle';
import FAQ from './pages/help/FAQ';
import Logout from './pages/Logout';
import AuthError from './pages/AuthError';
import DesktopDone from './pages/DesktopDone';
import CharacterPage from './pages/characters/CharacterPage';
import PlaysRankings from './pages/rankings/TopPlays';
import ScoreRankings from './pages/rankings/Score';
import SkillsRankings from './pages/rankings/Skills';
import RankedMaps from './pages/beatmaps/RankedMaps';
import Nomination from './pages/admin/Nomination';
import AddonsAdmin from './pages/admin/Addons';
import GradesRankings from './pages/rankings/Grades';

// Admin-only and the sole consumer of plotly (~4.7MB). Lazy-loaded so plotly
// lands in its own chunk fetched only when an admin opens this page, instead of
// bloating the bundle every visitor downloads.
const BalancingPage = lazy(() => import('./pages/admin/Balancing'));

// Each page receives the full PageProps (route params); static pages simply
// ignore them, dynamic pages read their segments off params.
const PAGE: {[key in Path]: ComponentType<PageProps>} = {
	[ROUTE.LANDING]: Home,
	[ROUTE.HOME]: Home,
	[ROUTE.NEWS]: News,
	[ROUTE.NEWS_ADMIN]: NewsAdmin,
	[ROUTE.DOWNLOAD]: PlayOsuIdle,

	[ROUTE.LOGIN]: Login,
	[ROUTE.LOGOUT]: Logout,
	
	[ROUTE.BEATMAP_LISTING]: RankedMaps,

	[ROUTE.RANKINGS_GLOBAL]: GlobalRankings,
	[ROUTE.RANKINGS_GLOBAL_SCORE]: ScoreRankings,
	[ROUTE.RANKINGS_GLOBAL_COUNTRY]: GlobalRankings,
	[ROUTE.RANKINGS_GLOBAL_SCORE_COUNTRY]: ScoreRankings,
	[ROUTE.RANKINGS_COUNTRY]: CountryRankings,
	[ROUTE.RANKINGS_PLAYS]: PlaysRankings,
	[ROUTE.RANKINGS_SKILLS]: SkillsRankings,
	[ROUTE.RANKINGS_SKILLS_COUNTRY]: SkillsRankings,
	[ROUTE.RANKINGS_GRADES]: GradesRankings,
	[ROUTE.RANKINGS_GRADES_COUNTRY]: GradesRankings,

	[ROUTE.NEWS_ARTICLE]: NewsArticle,
	[ROUTE.CHARACTER_PAGE]: CharacterPage,

	[ROUTE.HELP_FAQ]: FAQ,

	[ROUTE.AUTH_CALLBACK]: AuthCallback,
	[ROUTE.AUTH_DESKTOP]: DesktopDone,
	[ROUTE.AUTH_ERROR]: AuthError,
	
	[ROUTE.ADMIN_BALANCING]: BalancingPage,
	[ROUTE.ADMIN_NOMINATION]: Nomination,
	[ROUTE.ADMIN_ADDONS]: AddonsAdmin,
};

export default function Page() {
	const { route, params } = useMatch();
	const Component = PAGE[route] ?? PAGE[ROUTE.HOME];
	return (
		<Suspense fallback={null}>
			<Component current={route} params={params} />
		</Suspense>
	);
}
