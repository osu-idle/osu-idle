import 'dotenv/config';
import {
	desc,
	eq,
} from 'drizzle-orm';
import { db } from '../db/client';
import { news } from '../db/schema/news';
import { users } from '../db/schema/user';
import { htmlToMarkdown } from '../discord/markdown';
import { announceNews } from './announce';

/**
 * Post the newest published article to the news feed again, to eyeball the
 * formatting. It sends for real (run it with NODE_ENV=production, or the
 * announce no-ops), so it is deliberately not called `test`. Pass a slug to
 * preview a specific article.
 */
const preview = async () => {
	const slug = process.argv[2];
	const [row] = await db
		.select()
		.from(news)
		.where(slug ? eq(news.slug, slug) : eq(news.published, true))
		.orderBy(desc(news.publishedAt))
		.limit(1);

	if (!row) {
		console.error('No article to preview');
		return;
	}

	const [author] = await db
		.select({ username: users.username })
		.from(users)
		.where(eq(users.id, row.authorId))
		.limit(1);

	console.log(htmlToMarkdown(row.content));
	console.log('---');
	console.log(await announceNews(row, author?.username ?? 'unknown') ? 'sent' : 'failed');
};

preview().then(() => process.exit(0));
