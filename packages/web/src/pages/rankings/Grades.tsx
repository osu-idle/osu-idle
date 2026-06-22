import { GoodGrade } from '@osu-idle/shared/judgement';
import CountryFilter from '../../components/leaderboard/CountryFilter';
import { countryGradesRankPath, globalGradesRankPath, navigate } from '../../router';
import RankingsNav from './RankingsNav';
import PlayerGradesLeaderboard from '../../components/leaderboard/PlayerGradesLeaderboard';

export default function GradesRankings({ params: { country, grade, page }}: {
	params: { country?: string, grade?: GoodGrade | 'all', page?: number }
}) {
	grade = grade ?? 'all';
	page = page ?? 1;
	return (<>
		<main>
			<RankingsNav current={'grades'} />
			<CountryFilter selected={country} onSelect={country => navigate(country ? countryGradesRankPath(grade, country, page) : globalGradesRankPath(grade, page))} />

			<div className='page-contents'>
				<PlayerGradesLeaderboard sort={grade} country={country} page={page} />
			</div>
		</main>
	</>);
}
