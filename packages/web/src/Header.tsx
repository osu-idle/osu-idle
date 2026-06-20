import './Header.css';

import {  useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDiscord } from '@fortawesome/free-brands-svg-icons';

import Link from './components/Link';
import { Asset, beatmapListing, characterPath, globalSkillRankPath, ROUTE, type Path } from './router';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useCurrentCharacter } from './hooks/useCurrentCharacter';
import { useAdmin } from './hooks/useAdmin';
import { GUEST_AVATAR_URL } from '@osu-idle/shared/osu/profile';

// a dropdown entry: an in-app route, or an external link (e.g. the real osu! site)
type NavSub =
	| { label: string; to: Path | ':play' }
	| { label: string; href: string; target?: string };
type NavItem = { label: string; to: Path; sub: NavSub[] };

const NAV_ITEMS: NavItem[] = [
	{
		label: 'home',
		to: ROUTE.HOME,
		sub: [
			{
				label: 'news',
				to: ROUTE.NEWS,
			},
			{
				label: 'play osu!',
				href: 'https://osu.ppy.sh',
				target: '_blank',
			},
			{
				label: 'play osu!idle',
				to: ROUTE.DOWNLOAD,
			},
		],
	},
	{
		label: 'beatmaps',
		to: beatmapListing(),
		sub: [
			{
				label: 'beatmap listing',
				to: beatmapListing(),
			},
		],
	},
	{
		label: 'rankings',
		to: ROUTE.RANKINGS_GLOBAL,
		sub: [
			{
				label: 'global',
				to: ROUTE.RANKINGS_GLOBAL,
			},
			{
				label: 'skills',
				to: globalSkillRankPath('overall', 1),
			},
			{
				label: 'country',
				to: ROUTE.RANKINGS_COUNTRY,
			},
			{
				label: 'top plays',
				to: ROUTE.RANKINGS_PLAYS,
			},
		],
	},
	{
		label: 'help',
		to: ROUTE.HELP_FAQ,
		sub: [
			{
				label: 'faq',
				to: ROUTE.HELP_FAQ,
			},
		],
	},
] as const;

export default function Header() {
	const admin = useAdmin();
	const user = useCurrentUser();
	const character = useCurrentCharacter();
	const userMenu = useRef<HTMLDivElement>(null);
	const [menuVisible, setMenuVisible] = useState(false);
	const [userMenuActive, setUserMenuActive] = useState(false);

	useEffect(() => {
		const handleClickOutside = (event: PointerEvent) => {
			const target = event.target;
			if (!userMenu.current || !(target instanceof Node)) return;
			if (userMenu.current.contains(target)) return;
			setUserMenuActive(false);
		};

		document.addEventListener("pointerdown", handleClickOutside, true);

		return () => {
			document.removeEventListener("pointerdown", handleClickOutside);
		};
	}, []);

	return (<>
		<div className='topbar__menu-backdrop'></div>
		<header>
			<div className='topbar__menu' data-visibility={menuVisible ? 'visible' : 'hidden'}></div>
			<div className='topbar__menu-background'></div>
			<div className='topbar'>
				<nav className='topbar__group left'>
					<Link to={ROUTE.HOME} className="topbar__link">
						<div className='topbar__logo-link'>
							<div className="topbar__logo topbar__logo-bg"></div>
							<div className="topbar__logo"></div>
						</div>
					</Link>
					{NAV_ITEMS.map(({ label, to, sub }) => (
						<Link key={label} to={to} className="topbar__link regular"
							onMouseEnter={() => setMenuVisible(true)}
							onMouseLeave={() => setMenuVisible(false)}>
							<span>{label}</span>
							{sub && (
								<div className='topbar__sub'>
									{sub.map(item => (
										<Link key={item.label} className="topbar__sublink"
											to={'to' in item ? item.to : undefined}
											href={'href' in item ? item.href : undefined}
											target={'target' in item ? item.target : undefined}>
											<span>{item.label}</span>
										</Link>
									))}
								</div>
							)}
						</Link>
					))}
				</nav>
				<div className='topbar__group right'>
					<div className='topbar__link'>
						<Link href="https://discord.gg/Yd5GEaX8AJ" className='link-icon link-discord' target="_blank">
							<FontAwesomeIcon icon={faDiscord} />
						</Link>
					</div>
					<div className='topbar__link for-avatar'>
						<div
							ref={userMenu}
							className={`topbar__avatar ${userMenuActive ? 'active' : ''}`}
							style={{ backgroundImage: `url(${Asset(user?.avatarUrl ? user.avatarUrl : GUEST_AVATAR_URL)})` }}
							onClick={(e) => e.target === userMenu.current ? setUserMenuActive(!userMenuActive) : setUserMenuActive(true)}
						>
							{userMenuActive && (
								<div className='usermenu'>
									<div className='usermenu_profile'>{user?.username ?? 'Guest'}</div>
									<div className='usermenu_links'>
										{user && (<>
											{character && <Link to={characterPath(character.id)} className="usermenu__link">My Profile</Link>}
											{admin && <Link to={ROUTE.ADMIN_BALANCING} className="usermenu__link">Balancing</Link>}
											<Link to={ROUTE.LOGOUT} className="usermenu__link">Sign out</Link>
										</>)}
										{!user && (<>
											<Link to={ROUTE.LOGIN} className="usermenu__link">Sign in</Link>
										</>)}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</header>
	</>);
}
