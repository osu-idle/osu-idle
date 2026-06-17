import './ContextMenu.css';

export interface ContextMenuOption {
	label: string;
	/** the bar's accent colour (osu!-style full-width coloured buttons) */
	color: string;
	onClick: () => void;
}

type Props = {
	title: string;
	sub?: string;
	options: ContextMenuOption[];
	/** clicking outside the buttons cancels, same as the gray Cancel option */
	onClose: () => void;
};

/**
 * osu!-style contextual menu: a fullscreen dim overlay with a vertical stack of
 * full-width coloured buttons centred on the screen. Purely presentational -
 * the caller owns what the options do (and must close the menu itself).
 */
export default function ContextMenu({ title, sub, options, onClose }: Props) {
	return (
		<div className="ctxmenu" onClick={onClose}>
			<div className="ctxmenu__header">
				<div className="ctxmenu__title">{title}</div>
				{sub && <div className="ctxmenu__sub">{sub}</div>}
			</div>
			<div className="ctxmenu__options">
				{options.map((o) => (
					<button
						key={o.label}
						type="button"
						className="ctxmenu__option"
						style={{ '--accent': o.color } as React.CSSProperties}
						onClick={(e) => { e.stopPropagation(); o.onClick(); }}
					>
						{o.label}
					</button>
				))}
			</div>
		</div>
	);
}
