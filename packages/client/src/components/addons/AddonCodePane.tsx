import { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import AddonCodeEditor from './AddonCodeEditor';
import AddonCodeView from './AddonCodeView';
import CodeDiff from './CodeDiff';

type Props = {
	editing: boolean,
	source: string,
	onChange: (source: string) => void,
	/** View mode: an older source to diff against, enabling the "Changes" tab. */
	diffAgainst?: string,
};

/**
 * The right column shared by every add-on view: an editable editor,
 * a read-only view, or a unified diff with a Code / Changes toggle
 * when a diff is given.
 */
export default function AddonCodePane({ 
	editing, 
	source, 
	onChange, 
	diffAgainst, 
}: Props) {
	const mode = diffAgainst !== undefined ? 'diff' : 'code';
	const [tab, setTab] = useState<'code' | 'diff'>(mode);

	return (
		<>
			<div className='addon-view__codehead'>
				{diffAgainst !== undefined ? (
					<>
						<button 
							className={`addons__sort-btn ${tab === 'code' ? 'is-active' : ''}`} 
							onClick={() => setTab('code')}
						>
							<Trans>Code</Trans>
						</button>
						<button 
							className={`addons__sort-btn ${tab === 'diff' ? 'is-active' : ''}`} 
							onClick={() => setTab('diff')}
						>
							<Trans>Changes</Trans>
						</button>
					</>
				) : <span className='addon-view__codelabel'><Trans>Code</Trans></span>}
			</div>

			{editing
				? <AddonCodeEditor value={source} onChange={onChange} />
				: (tab === 'diff' && diffAgainst !== undefined
					? <CodeDiff before={diffAgainst} after={source} />
					: <AddonCodeView source={source} />)}
		</>
	);
}
