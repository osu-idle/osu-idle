import { OVERDRIVE_SYMBOL } from '../upgrades.js';

/** The player-facing form of an overdrive value: "3.4ω". */
export const overdriveText = (value: number): string =>
	value.toFixed(1) + OVERDRIVE_SYMBOL;
