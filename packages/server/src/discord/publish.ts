import { type RESTPostAPIWebhookWithTokenJSONBody } from 'discord-api-types/rest';

export const publish = async (webhook: string, message: RESTPostAPIWebhookWithTokenJSONBody) => {
	try {
		await fetch(webhook, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(message)
		});
	} catch(e) {
		console.log('Could not send webhook', e);
	}
};