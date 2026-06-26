import { z } from 'zod';

// Recursively make every field optional: object props, nested objects, and record values.
// Enum-keyed records become non-exhaustive (z.partialRecord) so individual keys can be omitted.
export const deepPartial = (schema: z.ZodType): z.ZodType => {
	const def = schema.def as {
		type: string;
		shape?: Record<string, z.ZodType>;
		keyType?: z.ZodType;
		valueType?: z.ZodType;
		error?: z.core.$ZodErrorMap;
	};
	if (def.type === 'object' && def.shape) {
		return z.object(Object.fromEntries(
			Object.entries(def.shape).map(([key, value]) => [key, deepPartial(value).optional()]),
		));
	}
	if (def.type === 'record' && def.keyType && def.valueType) {
		const key = def.keyType as unknown as z.core.$ZodRecordKey;
		const value = deepPartial(def.valueType);
		return def.keyType.def.type === 'enum'
			? z.partialRecord(key, value)
			: z.record(key, value, def.error ? { error: def.error } : undefined);
	}
	return schema;
};

export type DeepPartial<T> = T extends string | number | boolean | bigint | symbol | undefined
	? T
	: T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;