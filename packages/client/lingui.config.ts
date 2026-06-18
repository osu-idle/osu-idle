import { defineConfig } from '@lingui/conf';
import { formatter } from '@lingui/format-po';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@osu-idle/shared/i18n/locales';

// Scoped to the game client's own source, so its catalog never bleeds into the
// web platform's bundle and vice versa.
export default defineConfig({
	sourceLocale: DEFAULT_LOCALE,
	locales: [...SUPPORTED_LOCALES],
	// keep the source file in `#:` refs but drop the line - it churns the .po diff
	// whenever code moves
	format: formatter({ lineNumbers: false }),
	catalogs: [{
		path: '<rootDir>/src/locales/{locale}',
		include: ['src'],
	}],
});
