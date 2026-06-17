/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** Base URL of the osu! idle backend (used for the OAuth entry point). */
	readonly VITE_API_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

// `.po` catalogs are compiled to a `messages` export by @lingui/vite-plugin.
declare module '*.po' {
	import type { Messages } from '@lingui/core';
	export const messages: Messages;
}
