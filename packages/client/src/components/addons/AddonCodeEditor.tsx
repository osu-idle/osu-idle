import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prism-themes/themes/prism-vsc-dark-plus.css';

type Props = {
	value: string,
	onChange: (value: string) => void,
};

/**
 * Editable JS code field with VSCode Dark+ highlighting. The editor grows with
 * its content and sets `overflow:hidden` inline on itself, so the scrolling is
 * owned by the wrapper around it (which has the real height + border).
 */
export default function AddonCodeEditor({ value, onChange }: Props) {
	return (
		<div className='addon-code'>
			<Editor
				value={value}
				onValueChange={onChange}
				highlight={code => Prism.highlight(
					code,
					Prism.languages.javascript, 
					'javascript',
				)}
				padding={12}
				tabSize={4}
				insertSpaces={false}
				className='addon-code__inner'
				textareaClassName='addon-code__area'
			/>
		</div>
	);
}
