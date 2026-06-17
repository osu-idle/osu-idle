import sum from '../helpers/sum.js';

const avg = (...n: number[]) => sum(n) / n.length;

export default avg;
