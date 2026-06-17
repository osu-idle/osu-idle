import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import './LeaderboardFilters.css';
import { blackout } from '../../globals';

type Filter = {
	label: string,
	type: 'select',
	selected?: string,
	items: Item[],
	onSelection: (item: Item) => void,
};

type Item = {
	value: string,
	label: string,
};

const Select = ({ filter }: {
	filter: Filter
}) => {
	const current = filter.items.find(item => item.value === filter.selected);
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLDivElement>(null);
	const [rect, setRect] = useState<DOMRect>();

	const toggle = () => {
		if (open) { blackout.close(); return; }
		setRect(triggerRef.current?.getBoundingClientRect());
		blackout.open(() => setOpen(false));
		setOpen(true);
	};

	const select = (item: Item) => {
		filter.onSelection(item);
		blackout.close();
	};

	const trigger = (<div className='lb_select_current' onClick={toggle}>
		{current?.label}
		<FontAwesomeIcon icon={faChevronDown} className='arrow' />
	</div>);

	return (<div className='lb__select' ref={triggerRef}>
		{trigger}
		{open && rect && createPortal(
			<div className='lb__select open' style={{
				position: 'absolute',
				top: rect.top + window.scrollY,
				left: rect.left + window.scrollX,
				width: rect.width,
			}}>
				{trigger}
				<div className='lb_select_dropdown'>
					{filter.items.map(item => <div key={item.value} className='lb_select_dropdown_item' onClick={() => select(item)}>
						{item.label}
					</div>)}
				</div>
			</div>,
			document.body,
		)}
	</div>);
};

export default function LeaderboardFilters({ filters }: {
	filters: Filter[],
}) {

	return (<div className='lb_filters__container'>
		<div className='lb_filters'>
			{filters.map(filter => <div key={filter.label} className='lb__filter'>
				<div className='lb__filter_title'>{filter.label}</div>
				{filter.type === 'select' && <Select filter={filter} />}
			</div>)}
		</div>
	</div>);
}
