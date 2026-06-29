import {
	useCallback,
	useState,
} from 'react';
import OsuLogo from '../components/OsuLogo';
import LogoVisualizer from '../components/LogoVisualizer';
import {
	music,
	PLAYER_MODE,
} from '../audio/MusicPlayer';
import './MainMenu.css';
import Background from './Background';
import SceneManager, { SCENE } from './SceneManager';
import Device from '../responsive/Device';
import { useParallax } from '@osu-idle/shared/hooks/useParallax';
import Announce from '../components/Announce';
import {
	mapped,
	ValueIn,
} from '@osu-idle/shared/helpers/mapped';
import { useLingui } from '@lingui/react/macro';
import Controls from '../input/Controls';
import normalize from '@osu-idle/shared/math/normalize';
import {
	isOptionsOpen,
	isWebOpen,
	webUrl,
} from '../globals';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import Entities from '../entity/entities';
import { SETTINGS } from '../db/settings';
import { VERSION } from '@osu-idle/shared/version';
import DesktopUpdate from '../components/DesktopUpdate';
import Auth from '../online/auth';
import ContextMenu from '../components/ContextMenu';
import { desktop } from '@osu-idle/shared/desktop';

interface Props {
	/** play the white-flash "drop" entrance (true when arriving from the intro) */
	flash?: boolean
}

const MENU = mapped(['CLOSED', 'OPEN', 'PLAY']);
type Menu = ValueIn<typeof MENU>;

const OPTION = mapped([
	'PLAY',
	'WEBSITE', 
	'OPTIONS', 
	'EXIT', 
	'SOLO',
	'MULTI',
	'BACK',
]);
type Option = ValueIn<typeof OPTION>;

type OptionDisplay = {
	menu: Menu,
	title: string,
	band: 'out' | 'mid',
	flip: boolean,
	order: number,
	disabled?: true,
	onSelect: () => void,
};

export default function MainMenu({ flash = false }: Props) {
	music.mode.set(PLAYER_MODE.PLAYLIST);

	const closeTimeout = 500000;
	const { t } = useLingui();
	const [menu, setMenu] = useState<Menu>(MENU.CLOSED);
	const [exitConfirm, setExitConfirm] = useState(false);
	const [parallaxOn] = useSynced(SETTINGS.parallax);
	const parallax = useParallax(0.08, parallaxOn);
	const [character] = useSynced(Entities.character);

	const maxHeight = window.innerHeight * 0.5;
	const maxWidth = window.innerWidth * 0.75;
	const getLogoSize = () => Math.min(maxHeight, maxWidth);

	const [logoSize, setLogoSize] = useState(getLogoSize());
	Device.resize.on(() => setLogoSize(getLogoSize()));

	let cancelTimeout = 0;
	const mainClick = useCallback(() => {
		clearTimeout(cancelTimeout);
		cancelTimeout = setTimeout(() => setMenu(MENU.CLOSED), closeTimeout);
		switch(menu) {
			case MENU.CLOSED:
				setMenu(MENU.OPEN);
				break;
			case MENU.OPEN:
				setMenu(MENU.PLAY);
				break;
			case MENU.PLAY:
				toSongSelect();
				break;
		}
	}, [menu]);

	const toSongSelect = () => {
		clearTimeout(cancelTimeout);
		SceneManager.set(SCENE.SELECT);
	};

	// Exit only works in the desktop app; the browser forbids closing its own tab.
	const isDesktop = !!desktop();
	const exit = () => desktop()?.quit();

	const back = useCallback(() => {
		clearTimeout(cancelTimeout);
		cancelTimeout = setTimeout(() => setMenu(MENU.CLOSED), closeTimeout);
		switch(menu) {
			case MENU.CLOSED:
				// TODO: exit
				break;
			case MENU.OPEN:
				setMenu(MENU.CLOSED);
				break;
			case MENU.PLAY:
				setMenu(MENU.OPEN);
				break;
		}
	}, [menu]);

	Controls.back.usePress(back);

	const OPTION_DISPLAY: Record<Option, OptionDisplay> = {
	// Main menu
		[OPTION.PLAY]: {
			menu: MENU.OPEN,
			title: t`Play`,
			band: 'out',
			flip: false,
			order: 1,
			onSelect: () => setMenu(MENU.PLAY),
		},
		[OPTION.WEBSITE]: {
			menu: MENU.OPEN,
			title: t`Website`,
			band: 'mid',
			flip: false,
			order: 2,
			onSelect: async () => {
				if (character.isGuest()) { Auth.signIn(); return; }
				await webUrl.set(`c/${character.id}`);
				await isWebOpen.set(true);
			},
		},
		[OPTION.OPTIONS]: {
			menu: MENU.OPEN,
			title: t`Options`,
			band: 'mid',
			flip: true,
			order: 3,
			onSelect: () => { isOptionsOpen.set(!isOptionsOpen.get()); },
		},
		[OPTION.EXIT]: {
			menu: MENU.OPEN,
			title: t`Exit`,
			band: 'out',
			flip: true,
			order: 4,
			disabled: isDesktop ? undefined : true,
			onSelect: () => { if (isDesktop) setExitConfirm(true); },
		},

		// Play menu
		[OPTION.SOLO]: {
			menu: MENU.PLAY,
			title: t`Solo`,
			band: 'out',
			flip: false,
			order: 1,
			onSelect: toSongSelect,
		},
		[OPTION.MULTI]: {
			menu: MENU.PLAY,
			title: t`Multi`,
			band: 'mid',
			flip: false,
			disabled: true,
			order: 2,
			onSelect: () => {},
		},
		[OPTION.BACK]: {
			menu: MENU.PLAY,
			title: t`Back`,
			band: 'out',
			flip: true,
			order: 3,
			onSelect: () => setMenu(MENU.OPEN),
		},
	};

	// foreground content drifts opposite the background for depth
	const fgX = -parallax.x * 18;
	const fgY = -parallax.y * 18;

	const mobileShift = 1 - normalize(window.innerWidth, [400, 850]);

	return (
		<div className={`menu ${flash ? 'menu--flash' : ''}`}>
			<Background />
			<div className="menu__vignette" />

			<header className="menu__top">
			</header>
			<div className="menu__brand">
				<span className="menu__brand-name">osu!</span>
				<span className="menu__brand-tag">idle</span>
				<span className="menu__brand-version">v{VERSION}</span>
			</div>

			<div className="menu__center" style={{ transform: `translate(${fgX}px, ${fgY}px)` }}>
				<div className='menu__logo-options' style={{
					height: `${logoSize}px`,
					width: `${logoSize}px`,
					transform: `translate(${menu === MENU.CLOSED ? 'calc(-50%)' : `calc(-50% + ${Math.floor(logoSize / 2) - (mobileShift * logoSize / 2)}px)`}, -50%)`,
				}}>
					{Object.entries(Object.values(OPTION_DISPLAY)
						.sort((a, b) => a.order - b.order)
						.reduce((acc, option) => {
							if (!acc[option.menu]) acc[option.menu] = [];
							acc[option.menu].push(option);
							return acc;
						}, {} as Record<Menu, OptionDisplay[]>))
						.map(([currentMenu, group]) => (
							<div
								key={currentMenu}
								className={`menu__option_group ${menu === currentMenu ? 'visible' : ''}`}
								style={{ width: `${logoSize * 1.2}px` }}
							>
								{group.map(option => <div
									key={option.title}
									className={
										`menu__option ${option.band} ${menu === option.menu ? 'visible' : ''} ${option.flip ? 'flip' : ''} ${option.disabled ? 'disabled' : ''}`
									}
									onClick={option.onSelect}
								>
									<div className='menu__option_bg_safe'>
										<div 
											className='menu__option_bg' 
											style={{ backgroundImage: `url('/band_${option.band}.png')` }}
										>
										</div>
									</div>
									<div className='menu__option_bg_safe on'>
										<div 
											className='menu__option_bg' 
											style={{ backgroundImage: `url('/band_${option.band}_on.png')` }}
										>
										</div>
									</div>
									<div className='menu_option_contents'>
										{option.title}
									</div>
								</div>)}
							</div>
						))}
				</div>
				<div 
					className="menu__logo-menu" 
					style={{
						transform: `translateX(${menu === MENU.CLOSED ? 
							'0px' 
							: `-${(logoSize / 2) + (mobileShift * logoSize / 2)}px`})`,
					}}
				>
					<div className="menu__logo-enter">
						<LogoVisualizer size={logoSize} />
						<OsuLogo size={logoSize} onClick={mainClick} />
					</div>
				</div>
			</div>

			<Announce />
			<DesktopUpdate />

			{exitConfirm && (
				<ContextMenu
					title={t`Exit osu!idle`}
					sub={t`Are you sure you want to quit?`}
					onClose={() => setExitConfirm(false)}
					options={[
						{
							label: t`Exit`, color: '#e93100', onClick: exit, 
						},
						{
							label: t`Cancel`, color: '#6b6b6b', onClick: () => setExitConfirm(false), 
						},
					]}
				/>
			)}

			{flash && <div className="menu__flash" />}
		</div>
	);
}
