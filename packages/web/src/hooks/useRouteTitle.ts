import {
	type AnyRouteMatch,
	useRouterState,
} from '@tanstack/react-router';
import { useLingui } from '@lingui/react';
import { msg } from '@lingui/core/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { pageTitle } from '../globals';

const closestTitle = (matches: AnyRouteMatch[]) =>
	[...matches].reverse().find(m => m.staticData.title)?.staticData.title;

/**
 * The name of the current page: whatever a page pushed to `pageTitle`, else the
 * closest `staticData.title` up the match tree. Shown as the h1 and, capitalised,
 * as the document title.
 */
const useRouteTitle = () => {
	const { i18n } = useLingui();
	const [override] = useSynced(pageTitle);
	const titleMsg = useRouterState({ select: s => closestTitle(s.matches) });

	if (override !== '') return override;
	return i18n._(titleMsg ?? msg`dashboard`);
};

export default useRouteTitle;
