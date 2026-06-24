import './Header.css';

import {
	useEffect,
	useRef,
	useState,
} from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDiscord } from '@fortawesome/free-brands-svg-icons';

import Link from './components/Link';
import OutLink from './components/OutLink';
import { Asset } from './router';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useCurrentCharacter } from './hooks/useCurrentCharacter';
import { useAdmin } from './hooks/useAdmin';
import { SKILL_SORT } from './components/leaderboard/PlayerSkillLeaderboard';
import { GUEST_AVATAR_URL } from '@osu-idle/shared/osu/profile';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import { GOOD_GRADE } from '@osu-idle/shared/judgement';

export default function Header() {
	const { t } = useLingui();

	const admin = useAdmin();
	const user = useCurrentUser();
	const character = useCurrentCharacter();
	const userMenu = useRef<HTMLDivElement>(null);
	const [menuVisible, setMenuVisible] = useState(false);
	const [userMenuActive, setUserMenuActive] = useState(false);
	const [shrunk, setShrunk] = useState(false);

	const showSub = {
		onMouseEnter: () => setMenuVisible(true), onMouseLeave: () => setMenuVisible(false), 
	};

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
					<Link to='/' className="topbar__link">
						<div className='topbar__logo-link'>
							<div className="topbar__logo topbar__logo-bg"></div>
							<div className="topbar__logo"></div>
						</div>
					</Link>

					<Link to='/' className="topbar__link regular" {...showSub}>
						<span>{t`home`}</span>
						<div className='topbar__sub'>
							<Link to='/news' className="topbar__sublink"><span>{t`news`}</span></Link>
							<OutLink href='https://osu.ppy.sh' target='_blank' className="topbar__sublink"><span>{t`play osu!`}</span></OutLink>
							<Link to='/download' className="topbar__sublink"><span>{t`play osu!idle`}</span></Link>
						</div>
					</Link>

					<Link to='/maps' className="topbar__link regular" {...showSub}>
						<span>{t`beatmaps`}</span>
						<div className='topbar__sub'>
							<Link to='/maps' className="topbar__sublink"><span>{t`beatmap listing`}</span></Link>
						</div>
					</Link>

					<Link to='/rankings/global' search={{ page: 1 }} className="topbar__link regular" {...showSub}>
						<span>{t`rankings`}</span>
						<div className='topbar__sub'>
							<Link to='/rankings/global' search={{ page: 1 }} className="topbar__sublink">
								<span>{t`global`}</span>
							</Link>
							<Link 
								to='/rankings/skills/$skill'
								params={{ skill: SKILL_SORT.overall }}
								search={{ page: 1 }} 
								className="topbar__sublink"
							>
								<span>{t`skills`}</span>
							</Link>
							<Link
								to='/rankings/grades/$grade' 
								params={{ grade: GOOD_GRADE.X }} 
								search={{ page: 1 }} 
								className="topbar__sublink"
							>
								<span>{t`grades`}</span>
							</Link>
							<Link to='/rankings/country' search={{ page: 1 }} className="topbar__sublink">
								<span>{t`country`}</span>
							</Link>
							<Link to='/rankings/plays' search={{ page: 1 }} className="topbar__sublink">
								<span>{t`top plays`}</span>
							</Link>
						</div>
					</Link>

					<Link to='/help/faq' className="topbar__link regular" {...showSub}>
						<span>{t`help`}</span>
						<div className='topbar__sub'>
							<Link to='/help/faq' className="topbar__sublink"><span>{t`faq`}</span></Link>
						</div>
					</Link>

					{admin && (
						<Link to='/admin' className="topbar__link regular" {...showSub}>
							<span>{t`admin`}</span>
							<div className='topbar__sub'>
								<Link to='/admin/balancing' className="topbar__sublink"><span>{t`balancing`}</span></Link>
								<Link to='/admin/nomination' className="topbar__sublink"><span>{t`map nomination`}</span></Link>
								<Link to='/admin/addons' className="topbar__sublink"><span>{t`add-ons`}</span></Link>
								<Link to='/admin/skins' className="topbar__sublink"><span>{t`skins`}</span></Link>
							</div>
						</Link>
					)}
				</nav>
				<div className='topbar__group right'>
					<div className='topbar__link'>
						<OutLink href="https://discord.gg/Yd5GEaX8AJ" className='link-icon link-discord' target="_blank">
							<FontAwesomeIcon icon={faDiscord} />
						</OutLink>
					</div>
					<div className='topbar__link for-avatar'>
						<div
							ref={userMenu}
							className={`topbar__avatar ${userMenuActive ? 'active' : ''}`}
							style={{ backgroundImage: `url(${Asset(user?.avatarUrl ? user.avatarUrl : GUEST_AVATAR_URL)})` }}
							onClick={(e) => e.target === userMenu.current ? 
								setUserMenuActive(!userMenuActive) 
								: setUserMenuActive(true)
							}
						>
							{userMenuActive && (
								<div className='usermenu'>
									<div className='usermenu_profile'>{user?.username ?? 'Guest'}</div>
									<div className='usermenu_links'>
										{user && (<>
											{character && <Link to='/c/$id' params={{ id: String(character.id) }} className="usermenu__link">
												<Trans>My Profile</Trans>
											</Link>}
											<Link to='/logout' className="usermenu__link"><Trans>Sign out</Trans></Link>
										</>)}
										{!user && (<>
											<Link to='/login' className="usermenu__link"><Trans>Sign in</Trans></Link>
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
