import './Nav.css';
import { Path } from '../router';
import Link from './Link';

type Link = {
	id: string,
	label: string,
	link: Path,
};

export default function Nav({ current, links }: {
	current: string,
	links: Link[]
}) {

	return (<div className='page-header nav__container'>
		<div className='nav__list'>
			{links.map(link => (<Link to={link.link} className={`nav__item ${link.id === current ? 'current' : ''}`}>
				{link.label}
			</Link>))}
		</div>
	</div>);
}
