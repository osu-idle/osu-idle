import './Nav.css';
import type { ReactNode } from 'react';

/** The shared sub-nav bar container. Callers render their own typed Links inside,
 *  each tagged `nav__item` (plus `current` for the active one). */
export default function Nav({ children }: { children: ReactNode }) {
	return (<div className='page-header nav__container'>
		<div className='nav__list'>
			{children}
		</div>
	</div>);
}
