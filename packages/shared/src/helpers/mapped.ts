/** Build an identity map `{ A: 'A', B: 'B' }` from a list of string literals. */
export const mapped = <K extends string>(values: readonly K[]): { [V in K]: V } =>
	values.reduce((map, value) => {
		map[value] = value;
		return map;
	}, {} as { [V in K]: V });

export const values = <K extends string>(map: {[V in K]: V}): [K, ...K[]] => Object.values(map) as [K, ...K[]];

/** The union of a record's value types. */
export type ValueIn<R extends Record<string | number | symbol, unknown>> = R[keyof R];
