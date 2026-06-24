import { skinIconUrl } from '../../online/skins';

export default function SkinIcon({ 
	icon, 
	name, 
}: {
	icon: string | null, 
	name: string 
}) {
	const url = skinIconUrl(icon);
	return url
		? <img className='skin__icon' src={url} alt='' />
		: <div className='skin__icon skin__icon--empty'>
			{name.slice(0, 1).toUpperCase()}
		</div>;
}
