import {
	net,
	protocol,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
	APP_HOST,
	APP_SCHEME,
	REMOTE_PREFIXES,
	rendererDir,
	SITE_BASE,
} from './config';

const MIME: Record<string, string> = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.mjs': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.wasm': 'application/wasm',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.otf': 'font/otf',
	'.mp3': 'audio/mpeg',
	'.ogg': 'audio/ogg',
	'.wav': 'audio/wav',
	'.osz': 'application/octet-stream',
	'.txt': 'text/plain',
	'.map': 'application/json',
};

/** Must run before `app.whenReady()`: marks the bundle scheme standard + secure
 *  so the renderer is a secure context with a stable origin. */
export function registerAppSchemePrivileges(): void {
	protocol.registerSchemesAsPrivileged([{
		scheme: APP_SCHEME,
		privileges: {
			standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, 
		},
	}]);
}

const notFound = () => new Response('Not found', { status: 404 });

async function fileInfo(file: string): Promise<{ isFile: boolean; isDir: boolean }> {
	try {
		const s = await fs.stat(file);
		return {
			isFile: s.isFile(), isDir: s.isDirectory(), 
		};
	} catch {
		return {
			isFile: false, isDir: false, 
		};
	}
}

/** Serve the client bundle at `app://idle/`, and the web platform (its own SPA,
 *  built with base `/web/`) at `app://idle/web/`. Both fall back to their
 *  index.html for client-side routes, so deep paths resolve like a static host. */
export function registerAppProtocol(): void {
	protocol.handle(APP_SCHEME, async request => {
		const url = new URL(request.url);
		if (url.host !== APP_HOST) return notFound();

		let pathname = decodeURIComponent(url.pathname);

		// the large on-demand static library isn't bundled - stream it from the
		// website (same paths the browser uses), so the installer stays small.
		if (REMOTE_PREFIXES.some(p => pathname.startsWith(p))) {
			return net.fetch(`${SITE_BASE}${url.pathname}${url.search}`);
		}

		let kind: 'client' | 'web' = 'client';
		if (pathname === '/web' || pathname.startsWith('/web/')) {
			kind = 'web';
			pathname = pathname.slice('/web'.length) || '/';
		}

		const root = rendererDir(kind);
		const rel = pathname.replace(/^\/+/, '');
		let file = path.join(root, rel);
		// containment guard against `..` traversal out of the bundle
		if (file !== root && !file.startsWith(root + path.sep)) return notFound();

		const info = await fileInfo(file);
		if (info.isDir) {
			file = path.join(file, 'index.html');
		} else if (!info.isFile) {
			// a missing real asset (has an extension) is a genuine 404; anything else
			// is an SPA route → hand back the bundle's index.html
			if (path.extname(rel)) return notFound();
			file = path.join(root, 'index.html');
		}

		try {
			const data = await fs.readFile(file);
			const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
			return new Response(data, { headers: { 'content-type': type } });
		} catch {
			return notFound();
		}
	});
}
