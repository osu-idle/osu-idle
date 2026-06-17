const max = (array?: number[]): number => array?.reduce((acc, n) => n > acc ? n : acc, -Infinity) ?? 0;

export default max;