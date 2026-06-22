import { useEffect, useRef, useState } from 'react';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import './Options.css';
import { isOptionsOpen } from '../globals';
import { mapped, ValueIn } from '@osu-idle/shared/helpers/mapped';
import SignIn from '../components/options/SignIn';
import { Trans, useLingui } from '@lingui/react/macro';
import Language from '../components/options/Language';
import ShowFPS from '../components/options/ShowFPS';
import Fullscreen from '../components/options/Fullscreen';
import ParallaxMode from '../components/options/ParallaxMode';
import OsuMusicTheme from '../components/options/OsuMusicTheme';
import ShowThumbnails from '../components/options/ShowThumbnails';
import BackgroundDim from '../components/options/BackgroundDim';
import MasterVolume from '../components/options/MasterVolume';
import MusicVolume from '../components/options/MusicVolume';
import EffectVolume from '../components/options/EffectVolume';
import DeleteAllBeatmaps from '../components/options/DeleteAllBeatmaps';
import AutopilotDelay from '../components/options/AutopilotDelay';
import AutopilotMode from '../components/options/AutopilotMode';
import RightClickHold from '../components/options/RightClickHold';
import ManageAddons from '../components/options/ManageAddons';
import BrowseAddons from '../components/options/BrowseAddons';

/** A consumer component rendered inside a group. */
type OptComponent = () => JSX.Element;

export default function Options() {
	const { t } = useLingui();
	const [open] = useSynced(isOptionsOpen);
	const [query, setQuery] = useState('');
	const [active, setActive] = useState<string | null>(null);

	const CATEGORY = mapped([
		'GENERAL',
		'GRAPHICS',
		'GAMEPLAY',
		'CONTROLS',
		'ADDONS',
		'MAINTENANCE',
	]);
	type Category = ValueIn<typeof CATEGORY>;

	const CATEGORY_LABEL: Record<Category, string> = {
		[CATEGORY.GENERAL]: t`GENERAL`,
		[CATEGORY.GRAPHICS]: t`GRAPHICS`,
		[CATEGORY.GAMEPLAY]: t`GAMEPLAY`,
		[CATEGORY.CONTROLS]: t`CONTROLS`,
		[CATEGORY.ADDONS]: t`ADD-ONS`,
		[CATEGORY.MAINTENANCE]: t`MAINTENANCE`,
	};

	type CategoryDisplay = {
		name: Category,
		groups: {
			title: string,
			components: {
				search: string,
				component: () => OptComponent,
			}[]
		}[],
	};

	const Categories: CategoryDisplay[] = [
		{
			name: CATEGORY.GENERAL,
			groups: [
				{
					title: t`Sign in`,
					components: [
						{
							search: t`sign|in|login|connect|connexion`,
							component: () => SignIn,
						},
					],
				},
				{
					title: t`Language`,
					components: [
						{
							search: t`language|locale`,
							component: () => Language,
						},
					],
				},
			]
		},
		{
			name: CATEGORY.GRAPHICS,
			groups: [
				{
					title: t`Renderer`,
					components: [
						{
							search: t`fps|frame|rate|refresh|hz`,
							component: () => ShowFPS,
						},
					],
				},
				{
					title: t`Layout`,
					components: [
						{
							search: t`fullscreen`,
							component: () => Fullscreen,
						},
					],
				},
				{
					title: t`Main menu`,
					components: [
						{
							search: t`parallax`,
							component: () => ParallaxMode,
						},
						{
							search: t`osu|music|theme`,
							component: () => OsuMusicTheme,
						},
					],
				},
				{
					title: t`Song select`,
					components: [
						{
							search: t`thumb|thumbnail`,
							component: () => ShowThumbnails,
						},
					],
				},
			]
		},
		{
			name: CATEGORY.GAMEPLAY,
			groups: [
				{
					title: t`General`,
					components: [
						{
							search: t`background|dim|opacity`,
							component: () => BackgroundDim,
						},
						{
							search: t`autopilot|delay|restart`,
							component: () => AutopilotDelay,
						},
						{
							search: t`autopilot|mode|playlist|loop|next|song`,
							component: () => AutopilotMode,
						},
					],
				},
				{
					title: t`Volume`,
					components: [
						{
							search: t`volume`,
							component: () => MasterVolume,
						},
						{
							search: t`volume`,
							component: () => MusicVolume,
						},
						{
							search: t`volume`,
							component: () => EffectVolume,
						},
					],
				},
			]
		},
		{
			name: CATEGORY.CONTROLS,
			groups: [
				{
					title: t`General`,
					components: [
						{
							search: t`right|click|hold|time`,
							component: () => RightClickHold,
						},
					],
				},
			]
		},
		{
			name: CATEGORY.ADDONS,
			groups: [
				{
					title: t`Add-ons`,
					components: [
						{
							search: t`addon|addons|add-on|mod|mods|manage|installed`,
							component: () => ManageAddons,
						},
						{
							search: t`addon|addons|add-on|mod|mods|browse|catalog|install`,
							component: () => BrowseAddons,
						},
					],
				},
			]
		},
		{
			name: CATEGORY.MAINTENANCE,
			groups: [
				{
					title: t`General`,
					components: [
						{
							search: t`delete|beatmap|beatmaps`,
							component: () => DeleteAllBeatmaps,
						},
					],
				},
			]
		},
	];

	// A component is visible when the query is empty or matches its group title
	// or its `search` keywords; a group/category with nothing visible is dropped.
	const q = query.trim().toLowerCase();
	const visible = Categories
		.map(category => ({
			name: category.name,
			groups: category.groups
				.map(group => ({
					title: group.title,
					components: group.components.filter(c =>
						!q || `${group.title}|${c.search}`.toLowerCase().includes(q)),
				}))
				.filter(group => group.components.length > 0),
		}))
		.filter(category => category.groups.length > 0);

	const scrollRef = useRef<HTMLDivElement>(null);
	const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

	const scrollTo = (name: string) => {
		categoryRefs.current[name]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	// Highlight the topmost category in the sidebar as the panel scrolls.
	const onScroll = () => {
		const top = scrollRef.current?.getBoundingClientRect().top ?? 0;
		let current: string | null = null;
		for (const category of visible) {
			const el = categoryRefs.current[category.name];
			if (el && el.getBoundingClientRect().top - top <= 24) current = category.name;
		}
		setActive(current ?? visible[0]?.name ?? null);
	};

	// Reset scroll + active when (re)opened so it always starts at the top.
	useEffect(() => {
		if (!open) return;
		scrollRef.current?.scrollTo({ top: 0 });
		setActive(visible[0]?.name ?? null);
	}, [open]);

	const close = () => isOptionsOpen.set(false);

	return (
		<div
			className={`options__container ${open ? 'open' : ''}`}
			onClick={(e) => { if (e.target === e.currentTarget) close(); }}
		>
			{/* left side bar: one button per category, scrolling to it (dimmed when
			    the active search hides every group it owns) */}
			<div className='options__quick_access'>
				{Categories.map(category => {
					const shown = visible.some(c => c.name === category.name);
					return (
						<button
							key={category.name}
							type='button'
							className={`options__tab ${active === category.name ? 'is-active' : ''} ${shown ? '' : 'is-empty'}`}
							disabled={!shown}
							onClick={() => scrollTo(category.name)}
						>
							{CATEGORY_LABEL[category.name]}
						</button>
					);
				})}
			</div>

			<div className='options__panel'>
				<div className='options__scroll' ref={scrollRef} onScroll={onScroll}>
					<div className='options__heading'><Trans>Options</Trans></div>
					<div className='options__subheading'><Trans>Change the way osu!idle behaves</Trans></div>

					<label className='options__search'>
						<svg className='options__search_icon' viewBox='0 0 24 24' aria-hidden>
							<path fill='currentColor' d='M9.5 3a6.5 6.5 0 0 1 5.06 10.58l5.43 5.43-1.42 1.42-5.43-5.43A6.5 6.5 0 1 1 9.5 3m0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9' />
						</svg>
						<input
							className='options__search_input'
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder={t`Type to search!`}
						/>
					</label>
					{visible.map(category => (
						<div
							key={category.name}
							className='options__category'
							ref={(el) => { categoryRefs.current[category.name] = el; }}
						>
							<div className='options__category_title'>{CATEGORY_LABEL[category.name]}</div>
							{category.groups.map(group => (
								<div className='options__group' key={group.title}>
									<div className='options__group_title'>{group.title}</div>
									{group.components.map((c, i) => {
										const Component = c.component();
										return <Component key={i} />;
									})}
								</div>
							))}
						</div>
					))}

					{visible.length === 0 && (
						<div className='options__empty'><Trans>No matching settings.</Trans></div>
					)}
				</div>
			</div>
		</div>
	);
}
