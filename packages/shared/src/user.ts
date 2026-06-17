import { z } from 'zod';

export const userDTO = z.object({
	id: z.number().int().positive(),
	username: z.string(),
	avatarUrl: z.string().url().nullable(),
	country: z.string(), // ISO 3166-1 alpha-2, e.g. 'FR'
	createdAt: z.string(),
});

export type UserDTO = z.infer<typeof userDTO>;
