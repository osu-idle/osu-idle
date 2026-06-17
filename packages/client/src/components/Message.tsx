import './Message.css';
import { message } from '../globals';
import { useCallback, useState } from 'react';

type MessageState = {
	id: number,
	message: string,
	animate: boolean,
	close: boolean,
};

const ANIMATE_TIME = 1;
const FADE_TIME = 3000;
let id = 0;

export default function Message() {
	const [messages, setMessages] = useState<MessageState[]>([]);

	const addMessage = useCallback((message: string) => {
		const assignedId = id++;
		setMessages(prev => [...prev.map(m => ({ ...m, close: true })), {
			id: assignedId,
			message,
			animate: false,
			close: false,
		}]);

		setTimeout(() => {
			setMessages(prev => prev.map(m => m.id === assignedId ? { ...m, animate: true } : m));
		}, ANIMATE_TIME);
		setTimeout(() => {
			setMessages(prev => prev.map(m => m.id === assignedId ? { ...m, close: true } : m));
		}, FADE_TIME);
		setTimeout(() => {
			setMessages(prev => prev.filter(m => m.id !== assignedId));
		}, FADE_TIME + 1000);
	}, []);

	message.use(addMessage);

	return (
		<div className='message__overlay'>
			{messages.map(message => <div key={message.id} className={`message__contents ${message.animate ? 'animate' : ''} ${message.close ? 'closing' : ''}`}>
				{message.message}
			</div>)}
		</div>
	);
}