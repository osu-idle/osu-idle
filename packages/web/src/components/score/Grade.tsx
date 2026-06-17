import './Grade.css';

import { Grade as GradeName } from '@osu-idle/shared/judgement';
import { Asset } from '../../router';

export default function Grade({
	grade,
}: {
	grade: GradeName
}) {
	return (<div className='grade__container'>
		<div className='grade__img' style={{ backgroundImage: `url('${Asset(`/img/grade/grade-${grade}.svg`)}')` }}></div>
	</div>);
}