import type { ReactNode } from 'react';
import Synced from '@osu-idle/shared/helpers/synced';
import sleep from '@osu-idle/shared/helpers/sleep';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import './Transition.css';

const FADE_MS = 300;

type Phase = 'in' | 'covered' | 'out';

type TransitionState = {
	/** identifies the active transition so a stale handle can't drive a newer one */
	id: number;
	content: ReactNode;
	phase: Phase;
};

const state = new Synced<TransitionState | null>(null);
let counter = 0;

export class Transition {
	/** resolves once the screen is fully covered (fade-in done) */
	readonly covered: Promise<void>;
	private revealing?: Promise<void>;
	private readonly id = ++counter;

	private constructor(content: ReactNode) {
		void state.set({
			id: this.id, content, phase: 'in', 
		});
		this.covered = sleep(FADE_MS).then(() => {
			if (this.active()) 
				void state.set({
					id: this.id, content: this.content(), phase: 'covered', 
				});
		});
	}

	/** Begin a transition. Returns a handle the scenes use to drive the rest. */
	static begin(content: ReactNode): Transition {
		return new Transition(content);
	}

	private active(): boolean {
		return state.get()?.id === this.id;
	}

	private content(): ReactNode {
		return state.get()?.content ?? null;
	}

	setContent(content: ReactNode): void {
		if (!this.active()) return;
		const s = state.get()!;
		void state.set({
			...s, content, 
		});
	}

	/**
	 * Fade the cover out and tear it down. Waits for `covered` first, so the cover
	 * is always shown for at least one full fade even when the caller is ready
	 * early. Resolves once the screen is clear; idempotent.
	 */
	async reveal(): Promise<void> {
		return (this.revealing ??= (async () => {
			await this.covered;
			if (!this.active()) return;
			void state.set({
				...state.get()!, phase: 'out', 
			});
			await sleep(FADE_MS);
			if (this.active()) void state.set(null);
		})());
	}
}

export default function TransitionOverlay() {
	const [s] = useSynced(state);
	if (!s) return null;
	return (
		<div
			className={`transition transition--${s.phase}`}
			style={{ animationDuration: `${FADE_MS}ms` }}
		>
			{s.content}
		</div>
	);
}

/** A loading panel: spinner + a title/subtitle. The default "something's coming" content. */
export function LoadingPanel({ title, sub }: { title: string; sub?: string }) {
	return (
		<div className="transition__panel">
			<div className="transition__spinner" />
			<div className="transition__title">{title}</div>
			{sub && <div className="transition__sub">{sub}</div>}
		</div>
	);
}

export type DialogAction = { 
	label: string; 
	onClick: () => void; 
	primary?: boolean 
};

/** An interactive panel: a message plus one or more action buttons. */
export function DialogPanel({ 
	title,
	message,
	actions,
}: { 
	title: string;
	message?: string; 
	actions: DialogAction[] 
}) {
	return (
		<div className="transition__panel">
			<div className="transition__title">{title}</div>
			{message && <div className="transition__message">{message}</div>}
			<div className="transition__actions">
				{actions.map((a) => (
					<button
						key={a.label}
						type="button"
						className={`transition__btn ${a.primary ? 'transition__btn--primary' : ''}`}
						onClick={a.onClick}
					>
						{a.label}
					</button>
				))}
			</div>
		</div>
	);
}
