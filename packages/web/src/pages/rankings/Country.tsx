import { ROUTE } from '../../router';
import RankingsNav from './RankingsNav';

export default function CountryRankings() {
	return (<>
		<main>
			<RankingsNav current={ROUTE.RANKINGS_COUNTRY} />
		</main>
	</>);
}
