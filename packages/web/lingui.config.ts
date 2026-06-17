import { defineConfig } from '@lingui/conf';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@osu-idle/shared/i18n/locales';

// Catalogs are scoped to this package's own source, so the web bundle only ever
// ships web strings - never the game client's. Each app owns its catalog; the
// shared package owns the i18n runtime (and, later, a common catalog).
export default defineConfig({
	sourceLocale: DEFAULT_LOCALE,
	locales: [...SUPPORTED_LOCALES],
	catalogs: [{
		path: '<rootDir>/src/locales/{locale}',
		include: ['src'],
	}],
});
