const accuracy = (n?: string | number | null) => {
	if (n === null || n === undefined) return '-';

	const value = typeof n === 'number' ? n : parseFloat(n);
	if (Number.isNaN(value)) return '-';

	return `${(value * 100).toFixed(2)}%`;
};

export default accuracy;