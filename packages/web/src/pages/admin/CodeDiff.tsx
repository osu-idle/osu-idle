import Prism from 'prismjs';
import 'prism-themes/themes/prism-vsc-dark-plus.css';
import {
	DiffLine,
	diffLines,
} from '@osu-idle/shared/helpers/diff';

const SIGIL = {
	same: ' ', add: '+', remove: '-', 
} as const;

/** Unified line diff `before` → `after`, each line syntax-highlighted. */
export default function CodeDiff({ before, after }: { before: string; after: string }) {
	const lines = diffLines(before, after);
	const highlight = (line: DiffLine) => Prism.highlight(
		line.text,
		Prism.languages.javascript, 
		'javascript',
	) || ' ';
	return (
		<pre className='addons-admin__diff'>
			{lines.map((line, i) => (
				<div key={i} className={`addons-admin__diffline addons-admin__diffline--${line.type}`}>
					<span className='addons-admin__sigil'>{SIGIL[line.type]}</span>
					<code dangerouslySetInnerHTML={{ __html: highlight(line) }} />
				</div>
			))}
		</pre>
	);
}
