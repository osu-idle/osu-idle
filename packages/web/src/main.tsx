import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '@lingui/react';
import { detectBrowserLocale } from '@osu-idle/shared/i18n/locales';
import { i18n, activateLocale } from './i18n';
import '@osu-idle/shared/shared.css';
import './font.css';
import './styles.css';
import App from './App';

// Load the catalog for the browser's language before first render so the UI
// never flashes message keys. A saved user preference can override this later.
await activateLocale(detectBrowserLocale());

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<I18nProvider i18n={i18n}>
			<App />
		</I18nProvider>
	</StrictMode>,
);
