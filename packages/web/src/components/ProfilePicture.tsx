import { useState } from 'react';
import { Asset } from '../router';

const GUEST = Asset('/guest.png');

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
	avatarUrl?: string | null
};

export default function ProfilePicture({ avatarUrl, ...props }: Props) {
	const [failed, setFailed] = useState(false);
	return (
		<img
			src={!avatarUrl || failed ? GUEST : avatarUrl}
			onError={() => { if (!failed) setFailed(true); }}
			{...props}
			className={`profile-picture ${props.className}`}
		/>
	);
}
