export const length = (seconds: number): string => {
	const total = Math.floor(seconds);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};