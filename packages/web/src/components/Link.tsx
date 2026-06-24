import { createLink } from '@tanstack/react-router';
import {
	forwardRef,
	type AnchorHTMLAttributes,
} from 'react';

const Anchor = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
	(props, ref) => <a ref={ref} {...props} />,
);

/** In-app link. Wraps TanStack's Link so `to`/`params`/`search` are inferred from
 *  the route tree - the address bar updates and middle-click/new-tab work because
 *  it renders a real `href`. Use OutLink for external links. */
const Link = createLink(Anchor);

export default Link;
