import normalize from './normalize.js';

const transpose = (
	n: number, 
	range: [number, number], 
	target: [number, number],
) => 
	target[0] + (normalize(n, range) * (target[1] - target[0]));

export default transpose;
