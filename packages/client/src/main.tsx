import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '@lingui/react';
import { i18n, activateLocale } from './i18n';
import '@osu-idle/shared/shared.css';
import './index.css';
import './online/account'; // resolve the session + account, listen for login
import { initWakeLock } from './responsive/wakeLock';
import { initFullscreen } from './responsive/fullscreen';
import { SETTINGS } from './db/settings';
import App from './App.tsx';

initWakeLock(); // keep mobile screens awake while playing
initFullscreen(); // keep the fullscreen setting in sync with Esc/F11

// Load the saved language's catalog before first render so the UI never flashes
// message keys, and re-activate whenever the picker changes it. `sync` fires
// immediately with the current value (the browser's preferred locale on first
// run) and again on every change. We await it so the first catalog is live
// before render.
await SETTINGS.language.sync((locale) => activateLocale(locale));

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<I18nProvider i18n={i18n}>
			<App />
		</I18nProvider>
	</StrictMode>,
);
