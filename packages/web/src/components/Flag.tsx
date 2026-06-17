import './Flag.css';

import { useState } from 'react';
import { Asset } from '../router';

const UNKNOWN = Asset('/img/flags/Unknown.png');
const flagSrc = (code: string) => Asset(`/img/flags/${code.toUpperCase()}.png`);

export interface FlagProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
	/** ISO 3166-1 alpha-2 country code, e.g. 'FR' (as stored on the user). */
	country: string;
}

/** A country flag image. Falls back to the Unknown flag if the code has no
 *  matching asset (or the image fails to load). */
export default function Flag({ country, alt, ...props }: FlagProps) {
	// Track which code failed so a new `country` prop retries instead of staying on Unknown.
	const [failedCode, setFailedCode] = useState<string | null>(null);
	return (
		<img
			src={failedCode === country ? UNKNOWN : flagSrc(country)}
			alt={alt ?? country}
			onError={() => setFailedCode(country)}
			{...props}
			className={`country-flag ${props.className}`}
		/>
	);
}
