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
export default function SkinCodeEditor({ value, onChange }: Props) {
	return (
		<div className='skin-code'>
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
				className='skin-code__inner'
				textareaClassName='skin-code__area'
			/>
		</div>
	);
}
