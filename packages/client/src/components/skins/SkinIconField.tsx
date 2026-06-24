import { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import {
	skinIconUrl,
	uploadSkinIcon,
} from '../../online/skins';

type Props = {
	value: string | null,
	onChange: (icon: string | null) => void,
};

/** Icon upload + preview for the add-on editor. Owns its own upload state. */
export default function SkinIconField({ value, onChange }: Props) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>();

	const upload = async (file: File | undefined) => {
		if (!file) return;
		setBusy(true);
		setError(undefined);
		try {
			onChange(await uploadSkinIcon(file));
		} catch (e) {
			setError(String((e as Error).message ?? e));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className='skin-field'>
			<span><Trans>Icon</Trans></span>
			<div className='skin-icon-row'>
				{value && <img 
					className='skin-icon-preview'
					src={skinIconUrl(value)} 
					alt='' 
				/>}
				<label className='skin-btn'>
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
