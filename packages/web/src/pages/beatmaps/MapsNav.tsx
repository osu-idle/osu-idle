import Nav from '../../components/Nav';
import Link from '../../components/Link';
import { useLingui } from '@lingui/react/macro';

export default function MapsNav({ current }: {
	current: 'listing' | 'requests',
}) {
	const { t } = useLingui();

	const item = (id: string) => `nav__item ${id === current ? 'current' : ''}`;

	return (<Nav>
		<Link
			to='/maps'
			search={{
				sort: 'date', dir: 'desc',
			}}
			className={item('listing')}
		>
			{t`beatmap listing`}
		</Link>
		<Link
			to='/maps/requests'
			search={{
				filter: 'open', sort: 'support', page: 1,
			}}
			className={item('requests')}
		>
			{t`map requests`}
		</Link>
	</Nav>);
}
