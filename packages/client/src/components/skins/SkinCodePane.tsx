import { Trans } from '@lingui/react/macro';
import SkinCodeEditor from './SkinCodeEditor';
import SkinCodeView from './SkinCodeView';

type Props = {
	editing?: boolean,
	source: string,
	onChange: (source: string) => void,
};

/**
 * The right column shared by every skin view: an editable editor,
 * a read-only view, or a unified diff with a Code / Changes toggle
 * when a diff is given.
 */
export default function SkinCodePane({ 
	editing, 
	source, 
	onChange,
}: Props) {
	return (
		<>
			<div className='skin-view__codehead'>
				<span className='skin-view__codelabel'><Trans>Code</Trans></span>
			</div>

			{editing
				? <SkinCodeEditor value={source} onChange={onChange} />
				: <SkinCodeView source={source} />}
		</>
	);
}
