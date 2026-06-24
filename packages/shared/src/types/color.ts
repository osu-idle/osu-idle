import { z } from 'zod';

export const HexColorSchema = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);

export type HexColor = z.infer<typeof HexColorSchema>;