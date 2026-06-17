export const deferred = <T = void>() => {
	let r: (value: T | PromiseLike<T>) => void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let rr: (reason?: any) => void;
	const promise = new Promise<T>((resolve, reject) => {
		r = resolve;
		rr = reject;
	});
	return { promise, resolve: r!, reject: rr! };
};
