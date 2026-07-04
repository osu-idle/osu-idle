import './EditableCharacterName.css';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen } from '@fortawesome/free-solid-svg-icons';
import { renameCharacter } from '../api/users';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';

type Props = {
	name: string;
	/** Called with the new name after a successful rename. */
	onChange?: (name: string) => void;
};

/**
 * The signed-in player's own character name: click the pencil to rename it in
 * place (same rules as character creation). Shown instead of the plain name
 * when the viewer is looking at their own character.
 */
export default function EditableCharacterName({ name, onChange }: Props) {
	const { t } = useLingui();

	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();

	const open = () => {
		setDraft(name);
		setError(undefined);
		setEditing(true);
	};

	const submit = async () => {
		const next = draft.trim();
		if (!next || busy) return;
		if (next === name) {
			setEditing(false);
			return;
		}
		setBusy(true);
		setError(undefined);
		try {
			onChange?.((await renameCharacter(next)).name);
			setEditing(false);
		} catch (e) {
			setError(String((e as Error).message ?? e));
		} finally {
			setBusy(false);
		}
	};

	if (!editing) {
		return (
			<span className="editable-name">
				{name}
				<button
					type="button"
					className="editable-name__edit"
					onClick={open}
					title={t`Change username`}
				>
					<FontAwesomeIcon icon={faPen} />
				</button>
			</span>
		);
	}

	return (
		<span className="editable-name editable-name--editing">
			<input
				className="editable-name__input"
				value={draft}
				onChange={e => setDraft(e.target.value)}
				onKeyDown={e => {
					if (e.key === 'Enter') void submit();
					if (e.key === 'Escape') setEditing(false);
				}}
				maxLength={32}
				disabled={busy}
				autoFocus
			/>
			<button
				type="button"
				className="editable-name__btn"
				onClick={() => void submit()}
				disabled={busy || !draft.trim()}
			>
				<Trans>Save</Trans>
			</button>
			<button
				type="button"
				className="editable-name__btn editable-name__btn--cancel"
				onClick={() => setEditing(false)}
				disabled={busy}
			>
				<Trans>Cancel</Trans>
			</button>
			{error && <span className="editable-name__error">{error}</span>}
		</span>
	);
}
