const cubic_bezier = (x0: number, y0: number, x1: number, y1: number) => {
	if (!(x0 >= 0 && x0 <= 1 && x1 >= 0 && x1 <= 1)) {
		throw new Error(`CubicBezier x1 & x2 values must be { 0 < x < 1 }, got { x1 : ${x0}, x2: ${x1} }`);
	}
	const ax = 1.0 - (x1 = 3.0 * (x1 - x0) - (x0 *= 3.0)) - x0;
	const ay = 1.0 - (y1 = 3.0 * (y1 - y0) - (y0 *= 3.0)) - y0;

	let i = 0;
	let r = 0.0;
	let s = 0.0;
	let d = 0.0;
	let x = 0.0;

	return (t: number) => {
		if (t < 0) return 0;
		if (t > 1) return 1;
		for (r = t, i = 0; 32 > i; i++) {
			if (1e-5 > Math.abs((x = r * (r * (r * ax + x1) + x0) - t))) {
				return r * (r * (r * ay + y1) + y0);
			} else if (1e-5 > Math.abs((d = r * (r * ax * 3.0 + x1 * 2.0) + x0))) {
				break;
			} else {
				r -= x / d;
			}
		}

		if ((s = 0.0) > (r = t)) return 0;
		else if ((d = 1.0) < r) return 1;

		// Bisection fallback when Newton's method above did not converge. Both
		// branches must move the bracket AND recompute the midpoint: the previous
		// code did `s = r` without updating `r`, so the same `x` was retested every
		// pass and the loop never terminated - on a curve where Newton fails near
		// t≈1 (consistency's pressure curve when a pressure strain lands in
		// [0.998, 1)) this hung the whole process forever, no exception. The
		// iteration cap is a hard termination guarantee (64 halvings exhaust double
		// precision over [0, 1]).
		for (i = 0; d > s && i < 64; i++) {
			if (1e-5 > Math.abs((x = r * (r * (r * ax + x1) + x0)) - t)) break;
			if (t > x) s = r;
			else d = r;
			r = 0.5 * (d - s) + s;
		}

		return r * (r * (r * ay + y1) + y0);
	};
};

export default cubic_bezier;
