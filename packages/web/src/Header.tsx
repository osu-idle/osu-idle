import './Header.css';

import {  useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDiscord } from '@fortawesome/free-brands-svg-icons';

import Link from './components/Link';
import { Asset, beatmapListing, characterPath, countryRankPath, globalGradesRankPath, globalRankPath, globalSkillRankPath, playsRankPath, ROUTE, type Path } from './router';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useCurrentCharacter } from './hooks/useCurrentCharacter';
import { useAdmin } from './hooks/useAdmin';
import { GUEST_AVATAR_URL } from '@osu-idle/shared/osu/profile';
import { Trans, useLingui } from '@lingui/react/macro';
import { GOOD_GRADE } from '@osu-idle/shared/judgement';

// a dropdown entry: an in-app route, or an external link (e.g. the real osu! site)
type NavSub =
	| { label: string; to: Path | ':play' }
	| { label: string; href: string; target?: string };
type NavItem = { label: string; to: Path; sub: NavSub[] };

export default function Header() {
	const { t } = useLingui();

	const admin = useAdmin();
	const user = useCurrentUser();
	const character = useCurrentCharacter();
	const userMenu = useRef<HTMLDivElement>(null);
	const [menuVisible, setMenuVisible] = useState(false);
	const [userMenuActive, setUserMenuActive] = useState(false);
	const [shrunk, setShrunk] = useState(false);

	const NAV_ITEMS: NavItem[] = [
		{
			label: t`home`,
			to: ROUTE.HOME,
			sub: [
				{
					label: t`news`,
					to: ROUTE.NEWS,
				},
				{
					label: t`play osu!`,
					href: 'https://osu.ppy.sh',
					target: '_blank',
				},
				{
					label: t`play osu!idle`,
					to: ROUTE.DOWNLOAD,
				},
			],
		},
		{
			label: t`beatmaps`,
			to: beatmapListing(),
			sub: [
				{
					label: t`beatmap listing`,
					to: beatmapListing(),
				},
			],
		},
		{
			label: t`rankings`,
			to: ROUTE.RANKINGS_GLOBAL,
			sub: [
				{
					label: t`global`,
					to: globalRankPath(1),
				},
				{
					label: t`skills`,
					to: globalSkillRankPath('overall', 1),
				},
				{
					label: t`grades`,
					to: globalGradesRankPath(GOOD_GRADE.X, 1),
				},
				{
					label: t`country`,
					to: countryRankPath(1),
				},
				{
					label: t`top plays`,
					to: playsRankPath(1),
				},
			],
		},
		{
			label: t`help`,
			to: ROUTE.HELP_FAQ,
			sub: [
				{
					label: t`faq`,
					to: ROUTE.HELP_FAQ,
				},
			],
		},
	] as const;

	useEffect(() => {
		const handleScroll = () => setShrunk(window.scrollY > 0);
		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

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
			<div className={`topbar ${shrunk ? 'shrunk' : ''}`}>
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
											{character && <Link to={characterPath(character.id)} className="usermenu__link"><Trans>My Profile</Trans></Link>}
											{admin && (<>
												<Link to={ROUTE.ADMIN_BALANCING} className="usermenu__link"><Trans>Balancing</Trans></Link>
												<Link to={ROUTE.ADMIN_NOMINATION} className="usermenu__link"><Trans>Nomination</Trans></Link>
												<Link to={ROUTE.ADMIN_ADDONS} className="usermenu__link"><Trans>Add-ons</Trans></Link>
											</>)}
											<Link to={ROUTE.LOGOUT} className="usermenu__link"><Trans>Sign out</Trans></Link>
										</>)}
										{!user && (<>
											<Link to={ROUTE.LOGIN} className="usermenu__link"><Trans>Sign in</Trans></Link>
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
