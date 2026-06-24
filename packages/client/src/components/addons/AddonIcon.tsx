import { addonIconUrl } from '../../online/addons';

/** An add-on's icon, or its initial on a placeholder tile. */
export default function AddonIcon({ 
	icon, 
	name, 
}: {
	icon: string | null, 
	name: string 
}) {
	const url = addonIconUrl(icon);
	return url
		? <img className='addon__icon' src={url} alt='' />
		: <div className='addon__icon addon__icon--empty'>
			{name.slice(0, 1).toUpperCase()}
		</div>;
}
