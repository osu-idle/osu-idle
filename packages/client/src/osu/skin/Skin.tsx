import './Skin.css';
import { Grade } from '@osu-idle/shared/judgement';

export default class Skin {

	public static grade(grade: Grade, className: string = ''): JSX.Element {
		return <img
			className={`${className} skin__grade`}
			src={`/skins/default/grade-${grade}.png`}
			alt={`Grade ${grade}`}
			draggable={false}
		/>;
	}

}