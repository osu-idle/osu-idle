import useAsync from '@osu-idle/shared/hooks/useAsync';
import { countryName } from '@osu-idle/shared/display/country';
import { getCountries } from '../../api/rankings';
import { i18n } from '../../i18n';
import LeaderboardFilters from './LeaderboardFilters';
import { useLingui } from '@lingui/react/macro';

/** The shared "select a country" filter for the public leaderboards. Pulls the
 *  live country list from the server so it stays in sync as players join. The
 *  empty value means "All". */
export default function CountryFilter({ selected, onSelect }: {
	selected?: string,
	onSelect: (country: string) => void,
}) {
	const { t } = useLingui();
	const countries = useAsync(() => getCountries(), []);

	const items = [
		{ label: t`All`, value: '' },
		...(countries ?? []).map(c => ({ label: countryName(c.country, i18n.locale), value: c.country })),
	];

	return <LeaderboardFilters filters={[{
		label: t`country`,
		type: 'select',
		items,
		selected: selected ?? '',
		onSelection: item => onSelect(item.value),
	}]} />;
}
