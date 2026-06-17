import type { MouseEvent, ReactNode } from 'react';
import { HOME, navigate, Path } from '../router';

/** An in-app link: real `href` (so the in-game browser's address bar updates and
 * middle-click/new-tab work) that navigates client-side on plain left-click.
 *
 * Pass `href` (and usually `target="_blank"`) for an external link - these are
 * left to the browser's default handling instead of client-side navigation. */
export default function Link({ to, href, target, className, children, onMouseEnter, onMouseLeave }: {
	to?: Path | ':play';
	href?: string;
	target?: string;
	className?: string;
	children?: ReactNode;
	onMouseEnter?: () => void;
	onMouseLeave?: () => void;
}) {
	const external = href !== undefined || target === '_blank';

	const onClick = (e: MouseEvent) => {
		if (external || to === undefined) return;
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		if (to === ':play') {
			window.location.assign('/');
			return;
		}
		navigate(to);
	};

	return (
		<a
			href={href ?? (to !== undefined ? `${HOME}${to}` : undefined)}
			target={target}
			rel={target === '_blank' ? 'noopener noreferrer' : undefined}
			className={className}
			onClick={onClick}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			{children}
		</a>
	);
}
