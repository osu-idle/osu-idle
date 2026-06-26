import 'dotenv/config';
import '@osu-idle/shared/osu/controlPointPatch';
import { env } from '../env';

const publish = async () => {
	if (!env.MAP_FEED_WEBHOOK) return;

	const r = await fetch(env.MAP_FEED_WEBHOOK, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			'content': null,
			'embeds': [
				{
					'title': '${artist} - $(title)',
					// eslint-disable-next-line @stylistic/max-len
					'description': '`${difficulty}☆` `${version}`\n`${difficulty}☆` `${version}`\n`${difficulty}☆` `${version}`\n`${difficulty}☆` `${version}`',
					'color': 5814783,
					'author': { 'name': 'New ranked map by {creator}' },
					'image': { 'url': 'https://assets.ppy.sh/beatmaps/2555008/covers/cover.jpg' },
				},
			],
			'attachments': [],
		}),
	});

	console.log(await r.json());
};

publish().then(() => process.exit(0));