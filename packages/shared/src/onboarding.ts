import { z } from 'zod';

/** Character name payload, shared by onboarding and username changes. */
export const characterNameBody = z.object({ name: z.string().min(1).max(32) });
export type CharacterNameBody = z.infer<typeof characterNameBody>;

/**
 * First-login onboarding payload: name the new character. The account always
 * starts fresh - local Guest progress is no longer migrated online.
 */
export const onboardingBody = characterNameBody;
export type OnboardingBody = CharacterNameBody;
