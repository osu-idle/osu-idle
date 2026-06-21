#!/usr/bin/env node
// Quick heuristic sweep for user-facing strings that aren't wrapped for i18n.
// Not exact - false positives are fine, it's just a list to skim. Catches three
// shapes: JSX text on the same line as its tag, JSX text alone on its own line
// (multi-line nodes, e.g. button labels), and string-literal attributes.

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOTS = ['packages/client/src', 'packages/web/src'];

// A run of words that reads like real prose: starts with a letter, has at least
// one space-separated word or trailing punctuation, no code-ish characters.
const PROSE = /^[A-Za-z][A-Za-z!?'’.,:;()&\- ]*[A-Za-z!?.’'](?: ?)$/;
// Looks like prose, not an identifier/type: a space, or end punctuation.
const looksTranslatable = s => PROSE.test(s) && (/ /.test(s) || /[!?.]$/.test(s));
// Translatable string-literal attributes.
const ATTR = /(?:placeholder|title|aria-label|alt|label)="([A-Z][^"]*[a-z][^"]*)"/g;

const files = execSync(`git ls-files -- ${ROOTS.map(r => `'${r}/**/*.tsx'`).join(' ')}`, { encoding: 'utf8' })
	.split('\n')
	.filter(Boolean);

let count = 0;
const report = (file, i, hit) => {
	count++;
	console.log(`${file}:${i + 1}\t${hit}`);
};

for (const file of files) {
	const lines = readFileSync(file, 'utf8').split('\n');
	lines.forEach((line, i) => {
		const trimmed = line.trim();

		if (!/<\/?Trans/.test(line)) {
			// Text between two tags on the same line.
			for (const m of line.matchAll(/>([^<>{}]+)</g)) {
				const text = m[1].trim();
				if (looksTranslatable(text)) report(file, i, text);
			}
			// Text alone on its own line (multi-line JSX node). Exclude code-ish
			// punctuation that a prose label never has but TS lines do.
			if (!/[<>{}=():]/.test(trimmed) && looksTranslatable(trimmed)) {
				report(file, i, trimmed);
			}
		}
		for (const m of line.matchAll(ATTR)) report(file, i, m[1]);
	});
}

console.error(`\n${count} candidate string(s) - skim for real misses, false positives expected.`);
