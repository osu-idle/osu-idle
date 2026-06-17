import './Nav.css';
import { Path } from '../router';
import Link from './Link';

type Link = {
	label: string,
	link: Path,
};

export default function Nav({ current, links }: {
	current: Path,
	links: Link[]
}) {

	return (<div className='page-header nav__container'>
		<div className='nav__list'>
			{links.map(link => (<Link to={link.link} className={`nav__item ${link.link === current ? 'current' : ''}`}>
				{link.label}
			</Link>))}
		</div>
	</div>);
}
