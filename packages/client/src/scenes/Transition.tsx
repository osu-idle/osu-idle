import type { ReactNode } from 'react';
import Synced from '@osu-idle/shared/helpers/synced';
import sleep from '@osu-idle/shared/helpers/sleep';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import './Transition.css';

/**
 * A reusable full-screen transition between scenes. The lifecycle:
 *
 *   begin(content)  → fade IN over FADE_MS, then hold fully covering the screen
 *   …work happens behind the cover; either scene may swap the content…
 *   reveal()        → once covered AND the caller is ready, fade OUT, then resolve
 *
 * The screen is fully hidden between the end of the fade-in and the start of the
 * fade-out, so the outgoing scene can unmount and the incoming one mount (and do
 * slow work - load a beatmap, await the server) without any of it being visible.
 *
 * The handshake is two promises:
 *   - `covered` resolves when the fade-in completes (the screen is fully hidden).
 *     The incoming scene awaits this before showing dialogs / committing visuals.
 *   - `reveal()` is called by the incoming scene when it's ready to be seen; it
 *     waits for `covered` (so the cover is always shown at least one full FADE_MS)
 *     then fades out and resolves once the screen is clear - the caller resumes
 *     its real behaviour (e.g. starting gameplay) only after that.
 *
 * The overlay content is arbitrary ReactNode set by whichever scene owns the
 * moment, so the same primitive drives a plain black fade, a loading screen, or
 * an interactive error dialog.
 */
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
		void state.set({ id: this.id, content, phase: 'in' });
		this.covered = sleep(FADE_MS).then(() => {
			if (this.active()) void state.set({ id: this.id, content: this.content(), phase: 'covered' });
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

	/** Replace the overlay content (loading → error dialog, etc.). No-op once superseded. */
	setContent(content: ReactNode): void {
		if (!this.active()) return;
		const s = state.get()!;
		void state.set({ ...s, content });
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
			void state.set({ ...state.get()!, phase: 'out' });
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

export type DialogAction = { label: string; onClick: () => void; primary?: boolean };

/** An interactive panel: a message plus one or more action buttons. */
export function DialogPanel({ title, message, actions }: { title: string; message?: string; actions: DialogAction[] }) {
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
