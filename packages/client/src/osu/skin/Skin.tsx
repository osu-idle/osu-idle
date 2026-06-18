import './Skin.css';
import { Grade, JUDGEMENT, Judgement } from '@osu-idle/shared/judgement';

export default class Skin {

	public static hitObjectColor(column: number): string {
		switch(column) {
			case 0:
			case 3:
				return '#e8e8f0';
			case 1:
			case 2:
				return '#63b3ff';
		}
		return '#e8e8f0';
	}

	public static judgeColor(judge: Judgement): string {
		switch (judge) {
			case JUDGEMENT.MARVELOUS: return '#ffe88a';
			case JUDGEMENT.PERFECT: return '#ffd24a';
			case JUDGEMENT.GREAT: return '#6fe07a';
			case JUDGEMENT.GOOD: return '#4aa6ff';
			case JUDGEMENT.BAD: return '#b06bd6';
			case JUDGEMENT.MISS: return '#ff5a72';
		};
	}

	public static grade(grade: Grade, className: string = ''): JSX.Element {
		return <img
			className={`${className} skin__grade`}
			src={`/skins/default/grade-${grade}.png`}
			alt={`Grade ${grade}`}
			draggable={false}
		/>;
	}

}