import { defineConfig } from '@lingui/conf';
import { formatter } from '@lingui/format-po';
import {
	SUPPORTED_LOCALES,
	DEFAULT_LOCALE,
} from './src/i18n/locales.js';
import runtimeExtractor from '../../tools/lingui/runtime-extractor.mjs';

// shared builds with tsc (no macro transform), so it can't use the `t`/`<Trans>`
// macros - it localises through the runtime helpers in i18n/translate.ts, which
// this custom extractor reads. The compiled catalog ships in dist and is loaded
// by every consumer (see i18n/catalogs.ts).
export default defineConfig({
	sourceLocale: DEFAULT_LOCALE,
	locales: [...SUPPORTED_LOCALES],
	extractors: [runtimeExtractor],
	// keep the source file in `#:` refs but drop the line - it churns the .po diff
	// whenever code moves
	format: formatter({ lineNumbers: false }),
	catalogs: [{
		path: '<rootDir>/src/locales/{locale}',
		include: ['src'],
	}],
});
