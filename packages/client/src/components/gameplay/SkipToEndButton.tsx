/**
 * Debug-only: end the play now and go to the result screen.
 *
 * A local play resolves its remaining notes in place. A ranked one cannot - its
 * offsets stream in a few seconds at a time and the client is deliberately not
 * told the outcome up front - so it asks the server to end the play and reads
 * back the authoritative result. See `skipToEnd`.
 */
export default function SkipToEndButton({
	shown,
	onSkip,
}: {
	shown: boolean,
	onSkip: () => void,
}) {
	if (!shown) return null;

	return (
		<button className="play__skip" onClick={onSkip}>
			skip to end ⏭
		</button>
	);
}
