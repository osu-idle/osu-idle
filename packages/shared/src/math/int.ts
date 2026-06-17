const int = (val?: unknown): number | undefined => {
	if (val === null || val === undefined) return;
	if (typeof val === 'string') {
		val = parseInt(val, 10);
	}
	if (typeof val !== 'number') return;
	if (isNaN(val)) return;
	return Math.floor(val);
};

export default int;