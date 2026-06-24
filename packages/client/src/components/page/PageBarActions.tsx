import { useContext } from 'react';
import { createPortal } from 'react-dom';
import {
	PageBarSlot,
	type PageAction,
} from './pageBar';
import PageBarButton from './PageBarButton';

/** Append actions to the page's bottom bar from a sub-view. They share the one
 *  bar with the page's defaults; each action's `order` controls its position
 */
export default function PageBarActions({ actions }: { actions: PageAction[] }) {
	const slot = useContext(PageBarSlot);
	return slot ? createPortal(actions.map(a =>
		<PageBarButton
			key={a.id} 
			action={a} 
		/>,
	), slot) : null;
}
