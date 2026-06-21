// Country code -> human name via the platform's own CLDR data (Intl), so we
// ship no name table and it localizes to the active locale for free. Works in
// the browsers, Electron and Node.
const cache = new Map<string, Intl.DisplayNames>();

const display = (locale: string): Intl.DisplayNames => {
	let d = cache.get(locale);
	if (!d) {
		d = new Intl.DisplayNames([locale], { type: 'region' });
		cache.set(locale, d);
	}
	return d;
};

/** The localized name of an ISO 3166-1 alpha-2 country code (e.g. 'FR' ->
 *  'France'). Falls back to the code itself for unknown values. */
export function countryName(code: string, locale = 'en'): string {
	try {
		return display(locale).of(code.toUpperCase()) ?? code;
	} catch {
		return code;
	}
}
