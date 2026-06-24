import { z } from 'zod';

/**
 * First-login onboarding payload: name the new character. The account always
 * starts fresh - local Guest progress is no longer migrated online.
 */
export const onboardingBody = z.object({ name: z.string().min(1).max(32) });
export type OnboardingBody = z.infer<typeof onboardingBody>;
