const sum = (array?: number[]): number => 
	array?.reduce((acc, n) => acc + n, 0) ?? 0;

export default sum;