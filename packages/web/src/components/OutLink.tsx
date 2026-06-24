import type { ReactNode } from 'react';

/** A plain external link (real navigation / new tab). Use Link for in-app routes. */
export default function OutLink({ href, target, className, children }: {
	href: string;
	target?: string;
	className?: string;
	children?: ReactNode;
}) {
	return (
		<a
			href={href}
			target={target}
			rel={target === '_blank' ? 'noopener noreferrer' : undefined}
			className={className}
			onClick={e => e.stopPropagation()}
		>
			{children}
		</a>
	);
}
