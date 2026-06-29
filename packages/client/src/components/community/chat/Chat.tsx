import './Chat.css';
import {
	useEffect,
	useRef,
	useState,
} from 'react';
import { useLingui } from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import useSync from '@osu-idle/shared/hooks/useSync';
import { DEFAULT_CHANNEL } from '@osu-idle/shared/community/wire';
import Socket from '../../../online/socket';
import Tabs, { Tab } from '../../tabs/Tabs';
import { music } from '../../../audio/MusicPlayer';

export default function Chat() {
	const { t } = useLingui();
	const [channels, setChannels] = useState<string[]>([DEFAULT_CHANNEL]);
	const [active, setActive] = useState(DEFAULT_CHANNEL);
	const [activeTab, activeId] = useSync<string>();
	const inputRef = useRef<HTMLInputElement>(null);

	// osu! behaviour: clicking anywhere in the chat focuses the compose input
	const focusInput = () => {
		inputRef.current?.focus();
	};

	const closeChannel = (channel: string) => {
		const next = channels.filter(c => c !== channel);
		setChannels(next);
		if (active === channel && next.length) setActive(next[0]);
	};

	const join = () => {
		if (!channels.includes(DEFAULT_CHANNEL)) setChannels([DEFAULT_CHANNEL, ...channels]);
		setActive(DEFAULT_CHANNEL);
	};

	const ChatTabButton = ({ channel } : { channel: string }) => <>
		{channel}
		<button
			className="chat__close"
			aria-label={t`Close channel`}
			onClick={e => {
				e.stopPropagation();
				closeChannel(channel);
			}}
		></button>
	</>;

	const ChatTabContents = ({ channel } : { channel: string }) => {
		const [lines = []] = useSynced(Socket.chat);
		const [draft, setDraft] = useState('');
		const logRef = useRef<HTMLDivElement>(null);

		const shown = lines.filter(l => l.channel === channel);

		useEffect(() => {
			const el = logRef.current;
			if (el) el.scrollTop = el.scrollHeight;
		}, [shown.length]);

		const handleCommand = (text: string) => {
			if (text === '/np') {
				const np = music.beatmap.get();
				if (!np) return 'Nothing is playing';
				return `${np.set.metadata.artist} - ${np.set.metadata.title}`;
			}
			return text;
		};

		const submit = (e: React.FormEvent) => {
			e.preventDefault();
			const text = draft.trim();
			if (!text || !channels.includes(channel)) return;
			Socket.sendChat(handleCommand(text), channel);
			setDraft('');
		};

		return (<>
			<div className="chat__log" ref={logRef}>
				{shown.map((line, i) => {
					const d = new Date(line.at);
					const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

					if (line.kind === 'system') {
						return (
							<div key={i} className="chat__line chat__line--system">
								<span className="chat__text" style={{ color: line.color }}>{time} {line.text}</span>
							</div>
						);
					}

					return (
						<div key={i} className="chat__line">
							<span
								className="chat__from"
								style={{ color: line.from.color }}
							>{`${time} ${line.from.name}:`}</span>
							<span className="chat__text">{line.text}</span>
						</div>
					);
				})}
			</div>

			<form className="chat__compose" onSubmit={submit}>
				<span>
					{'>'}
				</span>
				<input
					ref={inputRef}
					type="text"
					value={draft}
					onChange={e => setDraft(e.target.value)}
				/>
			</form>
		</>);
	};

	const tabs: Tab[] = channels.map(channel => ({
		id: channel,
		label: <ChatTabButton channel={channel} />,
		render: () => <ChatTabContents channel={channel} />,
	}));

	return (
		<div className="chat" onClick={focusInput}>
			<div className="chat__tabs">
				<Tabs tabs={tabs} active={activeTab} onSelect={join} />
			</div>
			{tabs.find(t => t.id === activeId)?.render()}
		</div>
	);
}
