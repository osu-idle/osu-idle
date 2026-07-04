import type { InferRequestType } from 'hono/client';
import {
	rpc,
	unwrap,
} from './client';

/** Admin: a channel's rolling-day history + per-sender moderation state. */
export const getChatHistory = (channel: string) =>
	unwrap(rpc.v1.chat.history.$get({ query: { channel } }));

export type ChatHistory = Awaited<ReturnType<typeof getChatHistory>>;
export type ChatMessage = ChatHistory['messages'][number];

/** Admin: post as yourself, or `/announce <text>` for a system line. */
export const sendChatMessage = (channel: string, text: string) =>
	unwrap(rpc.v1.chat.message.$post({
		json: {
			channel, text, 
		}, 
	}));

/** A moderation action body (timeout / ban / delete …), inferred from the route. */
export type ModerateBody = InferRequestType<typeof rpc.v1.chat.moderate.$post>['json'];

export const moderateChat = (body: ModerateBody) =>
	unwrap(rpc.v1.chat.moderate.$post({ json: body }));
