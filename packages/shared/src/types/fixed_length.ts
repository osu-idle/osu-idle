export type FixedLength<T, N extends number, A extends readonly T[] = readonly []> =
	A['length'] extends N ? A : FixedLength<T, N, readonly [T, ...A]>;