import { useState } from 'react';
import Prism from 'prismjs';
import 'prism-themes/themes/prism-vsc-dark-plus.css';
import CodeDiff from './CodeDiff';

type View = 'none' | 'code' | 'diff';

/** The "View code / View changes" toggle and panels for one add-on. */
export default function AddonRowCode({
	source,
	reviewedSource, 
}: {
	source: string;
	reviewedSource: string | null 
},
) {
	const [view, setView] = useState<View>('none');
	// Changed since the last validation - lets the admin review only the delta.
	const hasChanges = !!reviewedSource && reviewedSource !== source;
	const toggle = (v: View) => setView(cur => cur === v ? 'none' : v);
	const highlight = (source: string) => Prism.highlight(
		source,
		Prism.languages.javascript, 
		'javascript',
	);

	return (
		<>
			<div className='addons-admin__codebar'>
				<button 
					className={`addons-admin__btn ${view === 'code' ? 'current' : ''}`}
					onClick={() => toggle('code')}
				>
					{view === 'code' ? 'Hide code' : 'View code'}
				</button>
				{hasChanges && (
					<button 
						className={`addons-admin__btn ${view === 'diff' ? 'current' : ''}`} 
						onClick={() => toggle('diff')}
					>
						{view === 'diff' ? 'Hide changes' : 'View changes since last review'}
					</button>
				)}
			</div>
			{view === 'code' && (
				<pre className='language-javascript addons-admin__code'>
					<code className='language-javascript' 
						dangerouslySetInnerHTML={{ __html: highlight(source) }} />
				</pre>
			)}
			{view === 'diff' && reviewedSource && (
				<div className='addons-admin__code'><CodeDiff before={reviewedSource} after={source} /></div>
			)}
		</>
	);
}
