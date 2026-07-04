import './ChatUserMenu.css';

import { useEffect } from 'react';
import type { ModerateBody } from '../../api/chat';

const TIMEOUTS: { label: string; seconds: number }[] = [
	{
		label: '10m', seconds: 600, 
	},
	{
		label: '1h', seconds: 3600, 
	},
	{
		label: '1d', seconds: 86400, 
	},
	{
		label: '7d', seconds: 604800, 
	},
	{
		label: '1mo', seconds: 2592000, 
	},
	{
		label: '1y', seconds: 31536000, 
	},
];

type Props = {
	x: number;
	y: number;
	channel: string;
	characterId: number;
	messageId: string;
	banned: boolean;
	timedOut: boolean;
	onAction: (body: ModerateBody) => void;
	onClose: () => void;
};

export default function ChatUserMenu(props: Props) {
	const {
		x, y, channel, characterId, messageId, banned, timedOut, onAction, onClose,
	} = props;

	useEffect(() => {
		const onDown = () => onClose();
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
		window.addEventListener('pointerdown', onDown);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('pointerdown', onDown);
			window.removeEventListener('keydown', onKey);
		};
	}, [onClose]);

	const act = (body: ModerateBody) => {
		onAction(body);
		onClose();
	};

	return (
		<div
			className='chat-menu'
			style={{
				left: x, top: y, 
			}}
			onPointerDown={e => e.stopPropagation()}
		>
			<span className='chat-menu__label'>Timeout</span>
			<div className='chat-menu__timeouts'>
				{TIMEOUTS.map(t => (
					<button
						key={t.seconds}
						onClick={() => act({
							action: 'timeout', characterId, seconds: t.seconds, channel, messageId,
						})}
					>{t.label}</button>
				))}
			</div>

			{timedOut && (
				<button
					className='chat-menu__item'
					onClick={() => act({
						action: 'untimeout', characterId,
					})}
				>Remove timeout</button>
			)}

			{banned ? (
				<button
					className='chat-menu__item'
					onClick={() => act({
						action: 'unban', characterId,
					})}
				>Unban</button>
			) : (
				<button
					className='chat-menu__item danger'
					onClick={() => act({
						action: 'ban', characterId, channel, messageId,
					})}
				>Ban from chat</button>
			)}

			<button
				className='chat-menu__item'
				onClick={() => act({
					action: 'delete', channel, ids: [messageId],
				})}
			>Delete message</button>
			<button
				className='chat-menu__item danger'
				onClick={() => act({
					action: 'deleteDay', channel, characterId,
				})}
			>Delete all today</button>
		</div>
	);
}
