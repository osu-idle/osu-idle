import { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import {
	addonIconUrl,
	uploadAddonIcon,
} from '../../online/addons';

type Props = {
	value: string | null,
	onChange: (icon: string | null) => void,
};

/** Icon upload + preview for the add-on editor. Owns its own upload state. */
export default function AddonIconField({ value, onChange }: Props) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>();

	const upload = async (file: File | undefined) => {
		if (!file) return;
		setBusy(true);
		setError(undefined);
		try {
			onChange(await uploadAddonIcon(file));
		} catch (e) {
			setError(String((e as Error).message ?? e));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className='addon-field'>
			<span><Trans>Icon</Trans></span>
			<div className='addon-icon-row'>
				{value && <img 
					className='addon-icon-preview'
					src={addonIconUrl(value)} 
					alt='' 
				/>}
				<label className='addon-btn'>
					<Trans>Upload image</Trans>
					<input 
						type='file' 
						accept='image/*' 
						hidden 
						disabled={busy} 
						onChange={e => upload(e.target.files?.[0])} 
					/>
				</label>
			</div>
			{error && <div className='page__error'>{error}</div>}
		</div>
	);
}
