const uuid = () => {
	let timestamp = new Date().getTime();
	let microstamp = performance.now() * 1000;
	const base = 16;

	const next = (c: string) => {
		let r = Math.random() * base;
		if (timestamp > 0) {
			r += timestamp;
			timestamp = Math.floor(timestamp/base);
		} else {
			r += microstamp;
			microstamp = Math.floor(timestamp/base);
		}
		r = r % base | 0;
		return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(base);
	};

	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, next);
};

export default uuid;