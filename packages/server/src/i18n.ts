import type { MiddlewareHandler } from 'hono';
import type { I18n } from '@lingui/core';
import { createI18n } from '@osu-idle/shared/i18n/runtime';
import { DEFAULT_LOCALE } from '@osu-idle/shared/i18n/locales';

declare module 'hono' {
	interface ContextVariableMap {
		i18n: I18n;
	}
}

/**
 * Attach a request-scoped i18n instance as `c.var.i18n`.
 *
 * Locale is hard-wired to English for now - request locale needs the
 * authenticated user's preference, which is out of scope. When that lands,
 * swap the constant for `negotiateLocale(...)` against a saved pref or the
 * `Accept-Language` header (see `@osu-idle/shared/i18n/locales`).
 *
 * The instance is per request, never a process-global: once locale negotiation
 * is live, concurrent requests in different locales must not share one mutable
 * active locale.
 *
 * Note this server runs under tsx/esbuild, which does not run Lingui's Babel
 * macros, so server code localises via the runtime API (`c.var.i18n._(...)`)
 * rather than the `t` / `<Trans>` macros the two frontends use.
 */
export const i18nMiddleware: MiddlewareHandler = async (c, next) => {
	c.set('i18n', createI18n(DEFAULT_LOCALE));
	await next();
};
