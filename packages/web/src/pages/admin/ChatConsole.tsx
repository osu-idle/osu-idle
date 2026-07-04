import './ChatConsole.css';

import {
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { DEFAULT_CHANNEL } from '@osu-idle/shared/community/wire';
import {
	type ChatHistory,
	type ModerateBody,
	getChatHistory,
	moderateChat,
	sendChatMessage,
} from '../../api/chat';
import ChatUserMenu from './ChatUserMenu';

const REFRESH_MS = 2000;

const fmtTime = (at: number): string => {
	const d = new Date(at);
	const p = (n: number) => n.toString().padStart(2, '0');
	return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

type MenuState = { x: number; y: number; characterId: number; messageId: string };

export default function ChatConsole() {
	const [data, setData] = useState<ChatHistory | null>(null);
	const [channel, setChannel] = useState<string>(DEFAULT_CHANNEL);
	const [draft, setDraft] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [menu, setMenu] = useState<MenuState | null>(null);
	const logRef = useRef<HTMLDivElement>(null);

	const refresh = useCallback(() =>
		getChatHistory(channel)
			.then(d => { setData(d); setError(null); })
			.catch(e => setError(String(e.message ?? e))), [channel]);

	useEffect(() => {
		void refresh();
		const id = setInterval(() => void refresh(), REFRESH_MS);
		return () => clearInterval(id);
	}, [refresh]);

	// Keep the log pinned to the newest line.
	const count = data?.messages.length ?? 0;
	useEffect(() => {
		const el = logRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [count]);

	const run = async (fn: () => Promise<unknown>) => {
		try { await fn(); await refresh(); }
		catch (e) { setError(String((e as Error).message ?? e)); }
	};

	const submit = (e: React.FormEvent) => {
		e.preventDefault();
		const text = draft.trim();
		if (!text) return;
		setDraft('');
		void run(() => sendChatMessage(channel, text));
	};

	const moderate = (body: ModerateBody) => void run(() => moderateChat(body));

	if (!data) return <main className='chat-console'>
		<p className='chat-console__muted'>{error ?? 'Loading…'}</p>
	</main>;

	const statusOf = (characterId: number) => data.moderation[characterId];
	const menuStatus = menu ? statusOf(menu.characterId) : undefined;

	return (
		<main className='chat-console'>
			<div className='chat-console__bar'>
				<select value={channel} onChange={e => setChannel(e.target.value)}>
					{data.channels.map(ch => <option key={ch} value={ch}>{ch}</option>)}
				</select>
				{error && <span className='chat-console__error'>{error}</span>}
			</div>

			<div className='chat-console__log' ref={logRef}>
				{data.messages.map(m => {
					const time = fmtTime(m.at);
					if (m.kind === 'system') return (
						<div key={m.id} className='chat-console__line system'>
							<span style={{ color: m.color }}>{time} {m.text}</span>
						</div>
					);
					const st = statusOf(m.from.characterId);
					const badge = st?.banned ? ' 🚫' : st?.timeoutUntil ? ' ⏳' : '';
					return (
						<div key={m.id} className='chat-console__line'>
							<span className='chat-console__time'>{time}</span>
							<button
								className='chat-console__user'
								style={{ color: m.from.color }}
								onClick={e => setMenu({
									x: e.clientX, y: e.clientY,
									characterId: m.from.characterId, messageId: m.id,
								})}
							>{m.from.name}{badge}:</button>
							<span className='chat-console__text'>{m.text}</span>
						</div>
					);
				})}
			</div>

			<form className='chat-console__compose' onSubmit={submit}>
				<input
					value={draft}
					onChange={e => setDraft(e.target.value)}
					placeholder='Message, or /announce something…'
				/>
				<button type='submit'>Send</button>
			</form>

			{menu && <ChatUserMenu
				x={menu.x}
				y={menu.y}
				channel={channel}
				characterId={menu.characterId}
				messageId={menu.messageId}
				banned={!!menuStatus?.banned}
				timedOut={!!menuStatus?.timeoutUntil}
				onAction={moderate}
				onClose={() => setMenu(null)}
			/>}
		</main>
	);
}
