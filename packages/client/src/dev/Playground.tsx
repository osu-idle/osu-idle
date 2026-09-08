import {
	useLayoutEffect,
	useState,
} from 'react';
import './playground.css';
import { PLAYGROUND_CASES } from './playgroundCases';

/**
 * Dev-only component bench, at `?playground`. Mounts one component at a time
 * with inputs that are slow or impossible to reach by playing - eighty levels of
 * XP gain, ten skills at once - so a change can be looked at (or driven by a
 * browser script) without a full play.
 *
 * `?playground=<case id>` opens straight onto a case, and `data-playground-ready`
 * lands on the stage once the case's state is seeded and it is mounted, which is
 * what a script should wait for.
 */
export default function Playground() {
	const params = new URLSearchParams(location.search);
	const wanted = params.get('playground');
	const [active, setActive] = useState(
		PLAYGROUND_CASES.find(c => c.id === wanted)?.id ?? PLAYGROUND_CASES[0]?.id,
	);
	const [run, setRun] = useState(0);
	const current = PLAYGROUND_CASES.find(c => c.id === active);
	const key = `${active}:${run}`;

	// a case that needs app state seeds it here, before anything renders with it
	const [seeded, setSeeded] = useState('');
	useLayoutEffect(() => {
		current?.setup?.();
		setSeeded(key);
	}, [key]);

	return (
		<div className="playground">
			<div className="playground__bar">
				{PLAYGROUND_CASES.map(c => (
					<button
						key={c.id}
						className={`playground__case ${c.id === active ? 'is-active' : ''}`}
						data-case={c.id}
						onClick={() => { setActive(c.id); setRun(r => r + 1); }}
					>
						{c.label}
					</button>
				))}
				<button className="playground__replay" onClick={() => setRun(r => r + 1)}>
					replay
				</button>
			</div>
			<div
				className="playground__stage"
				data-playground-ready={current && seeded === key ? 'true' : 'false'}
			>
				{seeded === key && <div key={key}>{current?.render()}</div>}
			</div>
		</div>
	);
}
