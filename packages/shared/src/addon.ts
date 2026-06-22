import { z } from 'zod';
import { VERSION } from './version.js';

/**
 * Add-on moderation lifecycle. An add-on is born `unpublished` (a private draft
 * owned by its author) and enters `pending` when submitted for review. An admin
 * then `published` it (publicly browsable), `denied` it, or leaves feedback
 * without a verdict, which parks it `onHold`. The author answering by updating
 * the add-on returns it to `pending`. The UI and server branch on these keys;
 * their human labels live in `display/addon` so the keys never carry presentation.
 */
export const ADDON_STATUS = {
	unpublished: 'unpublished',
	pending: 'pending',
	onHold: 'onHold',
	denied: 'denied',
	published: 'published',
} as const;
export type AddonStatus = (typeof ADDON_STATUS)[keyof typeof ADDON_STATUS];
export const ADDON_STATUSES = Object.values(ADDON_STATUS) as [AddonStatus, ...AddonStatus[]];

/** Semantic version `MAJOR.MINOR.PATCH`, the author-managed add-on version. */
const semver = z.string().trim().regex(/^\d+\.\d+\.\d+$/, 'Version must look like 1.2.3');

/** Free-form tags: lowercase, hyphen/alnum, deduped, capped. */
const tags = z.array(
	z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]*$/, 'Tags use lowercase letters, numbers and hyphens').max(24),
).max(8).transform(list => [...new Set(list)]);

/**
 * The starter source seeded into the editor when creating a new add-on. The
 * runtime imports an add-on as an ES module and drives it purely through these
 * two exports - no other API is exposed (add-ons run unsandboxed against the
 * page). `mount` runs when the add-on is enabled, `unmount` when it is disabled,
 * updated, or removed.
 */
export const ADDON_TEMPLATE = `// osu!idle add-on
export const mount = () => {
	// runs when the add-on is enabled
};

export const unmount = () => {
	// runs when the add-on is disabled / updated / removed
};
`;

/** Create payload. `version`/`gameVersion` default sensibly; `source` seeds the template. */
export const addonCreateBody = z.object({
	name: z.string().trim().min(1).max(80),
	description: z.string().trim().max(500).default(''),
	tags: tags.default([]),
	version: semver.default('0.1.0'),
	gameVersion: z.string().trim().max(20).default(VERSION),
	icon: z.string().max(512).nullable().default(null),
	source: z.string().min(1).default(ADDON_TEMPLATE),
});
export type AddonCreateBody = z.infer<typeof addonCreateBody>;

/** Edit payload (author): any subset of the editable fields. */
export const addonUpdateBody = addonCreateBody.partial();
export type AddonUpdateBody = z.infer<typeof addonUpdateBody>;

/** Moderation payload (admin): set the status, optionally leave feedback. */
export const addonModerateBody = z.object({
	status: z.enum(ADDON_STATUSES),
	feedback: z.string().max(2000).nullable().default(null),
});
export type AddonModerateBody = z.infer<typeof addonModerateBody>;
