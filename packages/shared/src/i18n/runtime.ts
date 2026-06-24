import {
	setupI18n,
	type I18n,
	type Messages,
} from '@lingui/core';
import {
	DEFAULT_LOCALE,
	type Locale,
} from './locales.js';

/**
 * A compiled Lingui catalog, as produced by `lingui compile` / loaded by the
 * Vite plugin: `import { messages } from './locales/en.po'`.
 */
export type Catalog = Messages;

/**
 * Create a fresh, isolated i18n instance with `catalogs` merged and `locale`
 * activated.
 *
 * The **server must use one instance per request** (never a process-global),
 * because concurrent requests can be in different locales and `activate()`
 * mutates the active locale - a shared instance would race. The two frontends
 * are single-locale at a time, so they use the `i18n` singleton from
 * `@lingui/core` via {@link loadAndActivate} instead.
 */
export function createI18n(
	locale: Locale = DEFAULT_LOCALE,
	...catalogs: Catalog[]
): I18n {
	const i18n = setupI18n();
	loadAndActivate(i18n, locale, ...catalogs);
	return i18n;
}

/**
 * Merge `catalogs` into `i18n` for `locale` and activate it. Each app composes
 * its own catalog (and, later, the shared common catalog) by passing several.
 */
export function loadAndActivate(
	i18n: I18n, 
	locale: Locale, 
	...catalogs: Catalog[]
): void {
	i18n.load(locale, Object.assign({}, ...catalogs));
	i18n.activate(locale);
}
