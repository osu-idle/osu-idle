import { z } from 'zod';

export const isZod = <T extends z.ZodTypeAny>(
	schema: T, 
	item: unknown,
): item is z.infer<T> => {
	return schema.safeParse(item).success;
};