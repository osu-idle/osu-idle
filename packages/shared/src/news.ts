import { z } from 'zod';

/**
 * News categories. Each tag drives the card's accent colour and its default
 * cover (used when no custom image is uploaded): `image` is a filename under
 * the web platform's `public/news-media/`, or null to fall back to the tag's
 * colour gradient. Shared so the server validates against the same set the
 * web and the in-game announcement render.
 */
export const NEWS_TAGS = {
	release: {
		label: 'release',   
		hue: 333, 
		image: 'release.png', 
	},
	update: {
		label: 'update',   
		hue: 205, 
		image: 'update.png', 
	},
	community: {
		label: 'community',
		hue: 150,
		image: null, 
	},
	event: {
		label: 'event',     
		hue: 35,  
		image: 'event.png', 
	},
	'dev-blog': {
		label: 'dev blog',  
		hue: 265,
		image: 'dev.jpg', 
	},
} as const;
export type NewsTag = keyof typeof NEWS_TAGS;
export const NEWS_TAG_NAMES = Object.keys(NEWS_TAGS) as [NewsTag, ...NewsTag[]];

/**
 * The news article wire contract - the single definition of a published post as
 * it crosses the network. The server's `news` table maps onto this via
 * `toNewsDTO`; the web renders it directly. `content` is trusted HTML authored
 * by an admin.
 */
export const newsDTO = z.object({
	id: z.number().int().positive(),
	slug: z.string(),
	title: z.string(),
	summary: z.string(),
	content: z.string(),
	tag: z.enum(NEWS_TAG_NAMES),
	imageUrl: z.string().nullable(), // custom cover, or null → tag default
	authorId: z.number().int(),
	authorName: z.string(),
	published: z.boolean(),
	publishedAt: z.string().nullable(), // ISO, null while a draft
	createdAt: z.string(),
	updatedAt: z.string(),
});
export type NewsDTO = z.infer<typeof newsDTO>;

/** URL-safe slug: lowercase letters, digits and single hyphens. */
const slug = z.string().trim().toLowerCase()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 
		'Slug may only contain lowercase letters, numbers and hyphens',
	)
	.min(1).max(120);

/** Create payload (admin only). `published` defaults to a draft. */
export const newsCreateBody = z.object({
	slug,
	title: z.string().trim().min(1).max(200),
	summary: z.string().trim().min(1).max(500),
	content: z.string().min(1),
	tag: z.enum(NEWS_TAG_NAMES),
	imageUrl: z.string().max(512).nullable().default(null),
	published: z.boolean().default(false),
});
export type NewsCreateBody = z.infer<typeof newsCreateBody>;

/** Update payload (admin only): any subset of the editable fields. */
export const newsUpdateBody = newsCreateBody.partial();
export type NewsUpdateBody = z.infer<typeof newsUpdateBody>;
