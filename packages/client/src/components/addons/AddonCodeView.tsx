import { useMemo } from 'react';
import Prism from 'prismjs';
import 'prism-themes/themes/prism-vsc-dark-plus.css';

/** Read-only JS code, highlighted with the VSCode Dark+ theme. */
export default function AddonCodeView({ source }: { source: string }) {
	const html = useMemo(() => {
		return Prism.highlight(source, Prism.languages.javascript, 'javascript');
	}, [source]);
	return (
		<pre className='language-javascript addon-codeview'>
			<code 
				className='language-javascript' 
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		</pre>
	);
}
