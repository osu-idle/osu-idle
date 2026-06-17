import clamp from './clamp.js';

const normalize = (n: number, range: [number, number]) => clamp((clamp(n, range[0], range[1]) - range[0]) / (range[1] - range[0]), 0, 1);

export default normalize;
