import {
	createContext,
	type ReactNode,
} from 'react';

export type PageAction = {
	id: string,
	label: ReactNode,
	onClick?: () => void,
	disabled?: boolean,
	/** Bar position; lower comes first. Defaults to 0. */
	order?: number,
	/** Render a non-interactive label instead of a button. */
	static?: boolean,
};

/** A page's bottom action-bar slot. Sub-views append their own actions into it
 *  (via PageBarActions) so they share the one real bottom bar. */
export const PageBarSlot = createContext<HTMLElement | null>(null);
