import gaussian from '../../math/gaussian.js';
import { Bot } from '../bot.js';

export default class BasicBot extends Bot {

	private sigmaMs = 40;

	gaussian() {
		return gaussian(this.sigmaMs);
	}

	pressOffset() {
		return this.gaussian();
	}
	releaseOffset() {
		return this.gaussian();
	}
}
