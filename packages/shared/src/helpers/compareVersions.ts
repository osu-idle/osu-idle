/** Compare two dotted version strings (`1.2.3`, `1.2.3.4`) numerically:
 *  negative when `a` is older, positive when newer, 0 when equal. */
const compareVersions = (a: string, b: string): number => {
	const as = a.split('.').map(Number);
	const bs = b.split('.').map(Number);
	for (let i = 0; i < Math.max(as.length, bs.length); i++) {
		const diff = (as[i] ?? 0) - (bs[i] ?? 0);
		if (diff) return diff;
	}
	return 0;
};

export default compareVersions;
