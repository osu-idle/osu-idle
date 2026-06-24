import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '@lingui/react';
import {
	RouterProvider,
	createRouter,
} from '@tanstack/react-router';
import type { MessageDescriptor } from '@lingui/core';
import { detectBrowserLocale } from '@osu-idle/shared/i18n/locales';
import {
	i18n,
	activateLocale,
} from './i18n';
import { routeTree } from './routeTree.gen';
import '@osu-idle/shared/shared.css';
import './font.css';
import './styles.css';

// Load the catalog for the browser's language before first render so the UI
// never flashes message keys. A saved user preference can override this later.
await activateLocale(detectBrowserLocale());

const router = createRouter({
	routeTree,
	basepath: '/web',
	defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
	interface Register { router: typeof router; }
	// Per-route page heading, translated lazily in the root layout.
	interface StaticDataRouteOption { title?: MessageDescriptor; }
}

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<I18nProvider i18n={i18n}>
			<RouterProvider router={router} />
		</I18nProvider>
	</StrictMode>,
);
