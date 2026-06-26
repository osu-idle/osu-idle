import { z } from 'zod';
import { isZod } from './is_zod.js';
import { __ } from '../i18n/translate.js';
import clamp from '../math/clamp.js';

export type RawRGBColor = [number, number, number, number];

const withValue = (msg: string, input: unknown): string => `${msg} (got ${JSON.stringify(input)})`;

export const HexColorSchema = z.string().regex(
	/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
	{ error: iss => withValue(__('Invalid #hex color'), iss.input) },
).brand<'HexColor'>();
export type HexColor = z.infer<typeof HexColorSchema>;

export const parseHexColor = (c: HexColor): RawRGBColor => {
	c = HexColorSchema.parse(c);

	let h = c.slice(1);

	if (h.length === 3 || h.length === 4) {
		h = h
			.split('')
			.map(ch => ch + ch)
			.join('');
	}

	if (h.length === 6) {
		h += 'ff';
	}

	return [
		clamp(parseInt(h.slice(0, 2), 16), 0, 255),
		clamp(parseInt(h.slice(2, 4), 16), 0, 255),
		clamp(parseInt(h.slice(4, 6), 16), 0, 255),
		clamp(parseInt(h.slice(6, 8), 16) / 255, 0, 1),
	];

};

export const RGBColorSchema = z.string().regex(
	/^rgba?\(\s*(?:\d{1,3}%?)(?:\s*,\s*(?:\d{1,3}%?)){2}(?:\s*,\s*(?:0|1|0?\.\d+|\d{1,3}%))?\s*\)$/i,
	{ error: iss => withValue(__('Invalid rgb()/rgba() color'), iss.input) },
).brand<'RGBColor'>();
export type RGBColor = z.infer<typeof RGBColorSchema>;

export function parseRGBA(input: RGBColor): RawRGBColor {
	const color = RGBColorSchema.parse(input);

	const match = color.match(/^rgba?\((.*)\)$/i);
	if (!match) {
		throw new Error('Invalid color');
	}

	const parts = match[1].split(',').map((p) => p.trim());

	const parseChannel = (v: string): number => {
		if (v.endsWith('%')) {
			return Math.round((Number(v.slice(0, -1)) / 100) * 255);
		}
		return Number(v);
	};

	const parseAlpha = (v: string): number => {
		if (v.endsWith('%')) {
			return Number(v.slice(0, -1)) / 100;
		}
		return Number(v);
	};

	const r = clamp(parseChannel(parts[0]), 0, 255);
	const g = clamp(parseChannel(parts[1]), 0, 255);
	const b = clamp(parseChannel(parts[2]), 0, 255);
	const a = clamp(parts[3] !== undefined ? parseAlpha(parts[3]) : 1, 0, 1);

	return [r, g, b, a];
}

const colorError = (iss: { input: unknown }) =>
	withValue(__('Invalid color: use a #hex (e.g. #63b3ff) or rgb()/rgba() value'), iss.input);
export const ColorSchema = z.union([RGBColorSchema, HexColorSchema], { error: colorError });
export type Color = z.infer<typeof ColorSchema>;

export const parseColor = (str: Color): RawRGBColor => {
	if (isZod(RGBColorSchema, str)) return parseRGBA(str);
	if (isZod(HexColorSchema, str)) return parseHexColor(str);
	return [0,0,0,1];
};

// Format alpha as a plain decimal: tiny floats (e.g. fade animations) would otherwise
// serialize as exponential notation ("1e-7") which is not valid CSS / fails the regex.
const alpha = (a: number): string => clamp(a, 0, 1).toFixed(4).replace(/\.?0+$/, '');

/** apply alpha to a colour */
export const colorA = (c: Color, a: number): RGBColor => {
	const [r, g, b] = parseColor(c);
	return RGBColorSchema.parse(`rgba(${r}, ${g}, ${b}, ${alpha(a)})`);
};

/** dim/brighten a colour by a factor. <1 to dimm >1 to brighten */
export const colorDim = (c: Color, dim: number): RGBColor => {
	const [r, g, b, a] = parseColor(c);
	const dimm = (c: number) => clamp(Math.floor(c * dim), 0, 255);
	return RGBColorSchema.parse(`rgba(${dimm(r)}, ${dimm(g)}, ${dimm(b)}, ${alpha(a)})`);
};