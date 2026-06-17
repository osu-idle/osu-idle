import num from './num.js';

const rank = (n?: number | null) => (n === null || n === undefined ? '-' : `#${num(n)}`);

export default rank;