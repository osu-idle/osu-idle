import { useMemo } from 'react';
import Prism from 'prismjs';
import 'prism-themes/themes/prism-vsc-dark-plus.css';
import {
	DiffLine,
	diffLines,
} from '@osu-idle/shared/helpers/diff';

const SIGIL = {
	same: ' ', add: '+', remove: '-', 
} as const;

/** Unified line diff of `before` → `after`, each line syntax-highlighted. */
export default function CodeDiff({ 
	before, 
	after, 
}: { 
	before: string, 
	after: string 
}) {
	const lines = useMemo(() => diffLines(before, after), [before, after]);
	const highlight = (line: DiffLine) => {
		return Prism.highlight(
			line.text,
			Prism.languages.javascript,
			'javascript',
		) || ' ';
	};
	return (
		<pre className='addon-diff'>
			{lines.map((line, i) => (
				<div key={i} className={`addon-diff__line addon-diff__line--${line.type}`}>
					<span className='addon-diff__sigil'>{SIGIL[line.type]}</span>
					<code dangerouslySetInnerHTML={{ __html: highlight(line) }} />
				</div>
			))}
		</pre>
	);
}
