import type Skill from './skill.js';
import Accuracy from './accuracy.js';
import Concentration from './concentration.js';
import Consistency from './consistency.js';
import Coordination from './coordination.js';
import JackSpeed from './jackspeed.js';
import Memory from './memory.js';
import Reading from './reading.js';
import Release from './release.js';
import Speed from './speed.js';
import SpeedJam from './speedjam.js';
import Stamina from './stamina.js';

export const makeOrderedSkills = (def = 0): Skill[] => [
	new Reading(def),
	new Speed(def),
	new Stamina(def),
	new JackSpeed(def),
	new Concentration(def),
	new Consistency(def),
	new Accuracy(def),
	new Release(def),
	new Coordination(def),
	new Memory(def),
	new SpeedJam(def),
];