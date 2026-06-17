import { Bot } from '../bot.js';

export default class BasicBot extends Bot {

	private sigmaMs = 40;

	gaussian() {
		return ((Math.random() + Math.random() + Math.random() - 1.5) / 1.5) * this.sigmaMs;
	}

	pressOffset() {
		return this.gaussian();
	}
	releaseOffset() {
		return this.gaussian();
	}
}
