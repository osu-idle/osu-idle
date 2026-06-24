/**
 * One line of a unified diff: unchanged, added (in the new text), or removed
 */
export type DiffLine = { type: 'same' | 'add' | 'remove', text: string };

/**
 * Line-level diff of two texts via a longest-common-subsequence walk. Returns a
 * unified sequence: `remove` lines come from `a`, `add` lines from `b`, `same`
 * lines are shared. O(n*m) - fine for add-on source files.
 */
export const diffLines = (a: string, b: string): DiffLine[] => {
	const A = a.split('\n'), B = b.split('\n');
	const n = A.length, m = B.length;

	// dp[i][j] = LCS length of A[i:] and B[j:]
	const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1)
		.fill(0));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			dp[i][j] = A[i] === B[j] ? 
				dp[i + 1][j + 1] + 1 
				: Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}

	const out: DiffLine[] = [];
	let i = 0, j = 0;
	while (i < n && j < m) {
		if (A[i] === B[j]) { out.push({
			type: 'same', text: A[i], 
		}); i++; j++; }
		else if (dp[i + 1][j] >= dp[i][j + 1]) { 
			out.push({
				type: 'remove', text: A[i], 
			}); 
			i++;
		}
		else { out.push({
			type: 'add', text: B[j], 
		}); j++; }
	}
	while (i < n) out.push({
		type: 'remove', text: A[i++], 
	});
	while (j < m) out.push({
		type: 'add', text: B[j++], 
	});
	return out;
};

/** Whether two texts differ at all. */
export const hasDiff = (a: string, b: string): boolean => a !== b;
