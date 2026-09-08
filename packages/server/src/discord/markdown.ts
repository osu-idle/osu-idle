/**
 * Turn the news editor's HTML into Discord markdown. The articles are written by
 * hand in a small, known set of tags (paragraphs, headings, lists, links, the
 * changelog's coloured tag spans), so a regex pass is enough - no parser, no
 * dependency. Anything unknown is stripped rather than shown raw.
 */

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: '\'',
	nbsp: ' ',
	hellip: '…',
	mdash: '—',
	ndash: '–',
	rsquo: '’',
	lsquo: '‘',
	ldquo: '“',
	rdquo: '”',
};

const decode = (text: string): string => text
	.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
	.replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
	.replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole);

export const htmlToMarkdown = (html: string): string => decode(html
	.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
	// The changelog's coloured `client` / `balance` chip reads as an inline label.
	.replace(/<span[^>]*class="[^"]*news-cl-tag[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '`$1` ')
	.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
	.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
	.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
	.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
	.replace(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n## $1\n')
	.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
	.replace(/<br\s*\/?>/gi, '\n')
	.replace(/<\/(p|div|ul|ol|blockquote|section|tr)>/gi, '\n\n')
	.replace(/<[^>]+>/g, ''),
)
	.replace(/^[ \t]+/gm, '')
	.replace(/[ \t]+$/gm, '')
	.replace(/\n{3,}/g, '\n\n')
	// A list reads as a block, so no blank line between its own items.
	.replace(/(^- .+)\n\n(?=- )/gm, '$1\n')
	.trim();

/**
 * Cut text into pieces that fit one embed description, breaking on a blank line
 * (else any line) so a paragraph is never split mid-sentence.
 */
export const chunkText = (text: string, max: number): string[] => {
	const parts: string[] = [];
	let rest = text;

	while (rest.length > max) {
		const window = rest.slice(0, max);
		const blank = window.lastIndexOf('\n\n');
		const line = window.lastIndexOf('\n');
		// Only honour a break past the halfway mark; a very early one would leave
		// a nearly empty embed behind.
		const at = Math.max(blank, line) > max / 2 ? Math.max(blank, line) : max;
		parts.push(rest.slice(0, at).trim());
		rest = rest.slice(at).trim();
	}

	if (rest) parts.push(rest);
	return parts;
};
