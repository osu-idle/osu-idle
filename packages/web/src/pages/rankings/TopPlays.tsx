import { ROUTE } from '../../router';
import RankingsNav from './RankingsNav';

export default function PlaysRankings() {
	return (<>
		<main>
			<RankingsNav current={ROUTE.RANKINGS_PLAYS} />
		</main>
	</>);
}
