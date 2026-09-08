/** Whether saving this article should post it to the Discord news feed. On by
 *  default; an article that already went out can't be posted twice, so the box
 *  is locked once it has. */
export default function AnnounceToggle({ announce, announced, onChange }: {
	announce: boolean,
	announced: boolean,
	onChange: (value: boolean) => void,
}) {
	return (
		<label className="news-field news-field--check">
			<input
				type="checkbox"
				checked={announce && !announced}
				disabled={announced}
				onChange={e => onChange(e.target.checked)}
			/>
			<span>Post to Discord when it goes live</span>
			<small>
				{announced
					? 'Already posted - an article only announces once.'
					: 'Untick to publish quietly.'}
			</small>
		</label>
	);
}
