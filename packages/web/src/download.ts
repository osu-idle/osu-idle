import { VERSION } from '@osu-idle/shared/version';

const DOWNLOAD_URL = (import.meta.env.VITE_DOWNLOAD_URL ?? '').replace(/\/$/, '');

export type Platform = 'windows' | 'mac' | 'linux' | 'other';

export const PLATFORM_LABEL: Record<Platform, string> = {
	windows: 'Windows',
	mac: 'macOS',
	linux: 'Linux',
	other: 'desktop',
};

/** Per-deploy publish manifest written next to the installers (see
 *  scripts/publish-desktop.mjs): the live version and each platform's filename. */
export interface DownloadManifest {
	version: string;
	files: Partial<Record<'windows' | 'linux', string | null>>;
}

/** A resolved download link for one platform. */
export interface DownloadLink {
	platform: Platform;
	label: string;
	href: string;
}

export function detectPlatform(): Platform {
	const ua = navigator.userAgent.toLowerCase();
	if (ua.includes('windows')) return 'windows';
	if (ua.includes('mac')) return 'mac';
	if (ua.includes('linux') || ua.includes('x11')) return 'linux';
	return 'other';
}

/** Fetch the publish manifest, or null when downloads aren't configured/available
 *  (e.g. dev, or before the first desktop publish). */
export async function fetchManifest(): Promise<DownloadManifest | null> {
	if (!DOWNLOAD_URL) return null;
	const res = await fetch(`${DOWNLOAD_URL}/manifest.json`, { cache: 'no-store' });
	return res.ok ? await res.json() as DownloadManifest : null;
}

const fileUrl = (file: string) => `${DOWNLOAD_URL}/${file}`;

/** The download link for one platform from the manifest, or null if we don't ship
 *  that platform (only Windows + Linux are built). */
function linkFor(manifest: DownloadManifest, platform: Platform): DownloadLink | null {
	const file = platform === 'windows' ? manifest.files.windows
		: platform === 'linux' ? manifest.files.linux
			: null;
	return file ? { platform, label: PLATFORM_LABEL[platform], href: fileUrl(file) } : null;
}

/** Resolve everything the download UI needs: the live version, the primary link
 *  for the visitor's platform (if shipped), and the other available platforms. */
export function resolveDownload(manifest: DownloadManifest | null, platform: Platform): {
	version: string;
	primary: DownloadLink | null;
	alternatives: DownloadLink[];
} {
	const version = manifest?.version ?? VERSION;
	if (!manifest) return { version, primary: null, alternatives: [] };

	const primary = linkFor(manifest, platform);
	const alternatives = (['windows', 'linux'] as const)
		.filter(p => p !== platform)
		.map(p => linkFor(manifest, p))
		.filter((l): l is DownloadLink => l !== null);

	return { version, primary, alternatives };
}
