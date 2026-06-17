import { i18n } from '@lingui/core';
import { loadAndActivate } from '@osu-idle/shared/i18n/runtime';
import { sharedCatalog } from '@osu-idle/shared/i18n/catalogs';
import type { Locale } from '@osu-idle/shared/i18n/locales';

/**
 * Load this locale's catalogs and activate them on the shared `i18n` singleton:
 * the game's own strings plus the catalog owned by `@osu-idle/shared` (skill
 * names etc.). Both are dynamic imports, so the game downloads only the language
 * actually in use - not every supported catalog.
 */
export async function activateLocale(locale: Locale): Promise<void> {
	const [shared, { messages: app }] = await Promise.all([
		sharedCatalog[locale](),
		import(`./locales/${locale}.po`),
	]);
	loadAndActivate(i18n, locale, shared, app);
}

export { i18n };
