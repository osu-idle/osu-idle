/**
 * Turns a plain-text changelog into the trusted HTML the article body renders.
 *
 * Input is light markdown:
 *   - free text at the top → intro paragraph(s)
 *   - `# Heading`          → a section (rendered as <h2>, matching the body CSS)
 *   - `- [project] text`   → a list item with a coloured project badge
 *
 * Inline `[label](url)`, `**bold**` and `*italic*` are supported in paragraphs
 * and list bodies. The leading `[project]` on a list item is consumed as the
 * badge, so it is never mistaken for a link.
 */

/** Project → badge hue. Echoes the news tag hues so the palettes feel related. */
const PROJECT_HUES: Record<string, number> = {
	client: 205, // blue
	desktop: 205, // blue
	server: 15,  // red
	web:    150, // green
	shared: 265, // purple
	scoring: 238, // dark blue
	balance: 238, // dark blue
};

const escapeHtml = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Escape, then expand the handful of inline markdown forms we allow. */
const inline = (text: string) =>
	escapeHtml(text)
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/\*([^*]+)\*/g, '<em>$1</em>');

/** Render one `- ` item, peeling off a leading `[project]` badge if present. */
function renderItem(body: string): string {
	const m = body.match(/^\[([^\]]+)\]\s*(.*)$/s);
	if (!m) return inline(body);
	const project = m[1].trim().toLowerCase();
	const hue = PROJECT_HUES[project];
	const colour = hue === undefined ? 'hsl(0 0% 42%)' : `hsl(${hue} 55% 42%)`;
	return `<span class="news-cl-tag" style="background:${colour}">${escapeHtml(project)}</span>${inline(m[2].trim())}`;
}

export function formatChangelog(raw: string): string {
	const out: string[] = [];
	let inList = false;
	let para: string[] = [];

	const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
	const flushPara = () => {
		if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
	};

	for (const rawLine of raw.replace(/\r\n/g, '\n').split('\n')) {
		const line = rawLine.trim();
		if (!line) { flushPara(); closeList(); continue; }

		if (line.startsWith('# ')) {
			flushPara(); closeList();
			out.push(`<h2 class="news-cl-heading">${inline(line.slice(2).trim())}</h2>`);
		} else if (line.startsWith('- ')) {
			flushPara();
			if (!inList) { out.push('<ul class="news-cl-list">'); inList = true; }
			out.push(`\t<li>${renderItem(line.slice(2).trim())}</li>`);
		} else {
			closeList();
			para.push(line);
		}
	}
	flushPara(); closeList();
	return out.join('\n');
}
