import { i18n as i18nSingleton, type I18n } from '@lingui/core';
import { generateMessageId } from '@lingui/message-utils/generateMessageId';

/**
 * Translate a source string (`__`, the gettext-style short name - and unlike
 * `translate`, it won't collide with CSS `translate()` when grepping) - the
 * no-macro equivalent of the frontends' `t` macro, for packages built without
 * the Lingui macro transform (`shared` via tsc, `server` via tsx).
 *
 * Same DX as the macro: pass the English source; the catalog id is derived from
 * it with the *same* hash the macros use (`generateMessageId`), so a string
 * resolves to one entry everywhere. Add `context` only to disambiguate two
 * identical sources (e.g. "Post" the verb vs the noun). `values` fills ICU
 * placeholders in the message (`'{n} days ago'` with `{ n }`).
 *
 * Resolves on the `@lingui/core` singleton by default - the frontends activate
 * their locale there (see i18n/runtime.ts), and the server currently has no
 * per-request locale (everything is English), so all callers can omit `i18n`.
 * The optional `i18n` is for once the server negotiates a locale per
 * (authenticated) request: it runs as a cluster and must then pass that
 * request-scoped instance rather than a shared mutable active locale.
 *
 * For these calls to be picked up by `lingui extract`, the `message` (and
 * `context`) must be **string literals** - see the custom extractor in
 * `tools/lingui/runtime-extractor.mjs`. Pass a non-literal and it still
 * translates at runtime, but won't be extracted.
 */
export function __(message: string, context?: string, values?: Record<string, unknown>, i18n: I18n = i18nSingleton): string {
	return i18n._(generateMessageId(message, context), values, { message });
}

/**
 * Tag a map of enum-keyed display strings for extraction. Identity at runtime -
 * it just returns the object - but the extractor harvests each string-literal
 * value into the catalog. Use it to keep display text out of the logic/types
 * (the enum keys) while still translating by key:
 *
 * ```ts
 * const SKILL_NAMES = defineMessages({ stamina: 'Stamina', ... });
 * const label = __(SKILL_NAMES[skill]); // id matches the literal
 * ```
 *
 * Values may also be arrays (e.g. a per-level list); the extractor harvests each
 * string-literal element, while non-string elements (numbers) are passed through
 * untranslated.
 */
export function defineMessages<T extends Record<string, string | readonly (string | number)[]>>(catalog: T): T {
	return catalog;
}
