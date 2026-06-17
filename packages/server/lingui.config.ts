import { defineConfig } from '@lingui/conf';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@osu-idle/shared/i18n/locales';
import runtimeExtractor from '../../tools/lingui/runtime-extractor.mjs';

// The server runs under tsx (no macro transform), so it localises through the
// runtime helpers in @osu-idle/shared/i18n/translate, read by this custom
// extractor. English is the source locale and currently the only one served, so
// no catalog is loaded yet - `translate` falls back to the source text; these
// extracted catalogs are ready for when request-locale negotiation lands.
export default defineConfig({
	sourceLocale: DEFAULT_LOCALE,
	locales: [...SUPPORTED_LOCALES],
	extractors: [runtimeExtractor],
	catalogs: [{
		path: '<rootDir>/src/locales/{locale}',
		include: ['src'],
	}],
});
