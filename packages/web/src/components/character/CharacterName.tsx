import { useState } from 'react';
import EditableCharacterName from '../EditableCharacterName';
import FormerNames from '../FormerNames';

type Props = {
	name: string;
	formerNames: string[];
	/** Whether the viewer owns this character and may rename it. */
	editable: boolean;
};

/** A character's name plus its former-names tooltip; editable in place when
 *  the viewer is looking at their own character. Renames update locally
 *  without a refetch. */
export default function CharacterName({ name, formerNames, editable }: Props) {
	const [override, setOverride] = useState<{ name: string; formerNames: string[] }>();
	const current = override?.name ?? name;
	const former = override?.formerNames ?? formerNames;
	const renamed = (next: string) => setOverride({
		name: next,
		formerNames: [...new Set([...former, current])].filter(n => n !== next),
	});

	return (
		<div className='character__meta-name'>
			{editable
				? <EditableCharacterName name={current} onChange={renamed} />
				: current}
			<FormerNames names={former} />
		</div>
	);
}
