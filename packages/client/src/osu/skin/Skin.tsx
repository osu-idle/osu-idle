import Synced from '@osu-idle/shared/helpers/synced';
import './Skin.css';
import {
	GRADE,
	Grade,
	Judgement,
	JUDGEMENT,
} from '@osu-idle/shared/judgement';
import { HexColor } from '@osu-idle/shared/types/color';
import { merge } from "ts-deepmerge";
import { SkinDAO } from '../../db/schema/skin';

export const defaultSkin = {
	hitObjects: [
		{ color: '#e8e8f0' },
		{ color: '#63b3ff' },
		{ color: '#63b3ff' },
		{ color: '#e8e8f0' },
	],
	judgements: {
		[JUDGEMENT.MARVELOUS]: '#ffe88a',
		[JUDGEMENT.PERFECT]: '#ffd24a',
		[JUDGEMENT.GREAT]: '#6fe07a',
		[JUDGEMENT.GOOD]: '#4aa6ff',
		[JUDGEMENT.BAD]: '#b06bd6',
		[JUDGEMENT.MISS]: '#ff5a72',
	} satisfies {[key in Judgement]: HexColor},
	hpBar: {
		width: 16,
		height: 340,
		gap: 5,
		fromBottom: 0,
		radius: 4,
		background: 'rgba(0, 0, 0, 0.45)',
		fill: '#ffffff',
		fillLow: '#ff5a72',
		lowThreshold: 0.3,
		transitionMs: 200,
	},
	grade: {
		[GRADE.X]: `/skins/default/grade-X.png`,
		[GRADE.SS]: `/skins/default/grade-SS.png`,
		[GRADE.S]: `/skins/default/grade-S.png`,
		[GRADE.A]: `/skins/default/grade-A.png`,
		[GRADE.B]: `/skins/default/grade-B.png`,
		[GRADE.C]: `/skins/default/grade-C.png`,
		[GRADE.D]: `/skins/default/grade-D.png`,
		[GRADE.F]: `/skins/default/grade-F.png`,
	} satisfies {[key in Grade]: string},
};

export type SkinDefinition = typeof defaultSkin;

export default class Skin {

	public readonly data: SkinDefinition;

	constructor(protected definition?: SkinDefinition) {
		this.data = merge(defaultSkin, definition ?? {});

		// deep merge concats the hitobject array so we overwrite the specified cols
		this.data.hitObjects = defaultSkin.hitObjects;
		if (definition?.hitObjects) {
			for (let i = 0; i < definition.hitObjects.length; i++) {
				this.data.hitObjects[i] = definition.hitObjects[i];
			}
		}
	}

	public grade(grade: Grade, className: string = ''): JSX.Element {
		return <img
			className={`${className} skin__grade`}
			src={this.data.grade[grade]}
			alt={`Grade ${grade}`}
			draggable={false}
		/>;
	}

}

export const currentSkin = new Synced(new Skin());

currentSkin.sync(current => console.log(current));

SkinDAO.getEnabled().then(current => {
	if (current) currentSkin.set(new Skin(JSON.parse(current.definition)));
});