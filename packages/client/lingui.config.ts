import { defineConfig } from '@lingui/conf';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@osu-idle/shared/i18n/locales';

// Scoped to the game client's own source, so its catalog never bleeds into the
// web platform's bundle and vice versa.
export default defineConfig({
	sourceLocale: DEFAULT_LOCALE,
	locales: [...SUPPORTED_LOCALES],
	catalogs: [{
		path: '<rootDir>/src/locales/{locale}',
		include: ['src'],
	}],
});
