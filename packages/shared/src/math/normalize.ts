import clamp from './clamp.js';
import cubic_bezier from './cubic_bezier.js';

/**
 * Transforms a number from a clamped range into a [0, 1] linear
 */
const normalize = (n: number, range: [number, number]) => 
	clamp((clamp(n, range[0], range[1]) - range[0]) / (range[1] - range[0]), 0, 1);

export const smoothNormalize = (
	n: number, 
	range: [number, number], 
	smoothness = 1,
) => 
	cubic_bezier(
		.25 + (.25 * smoothness),
		.25 - (.25 * smoothness), 
		.75 - (.25 * smoothness), 
		.75 + (.25 * smoothness))
	(normalize(n, range));

export default normalize;
