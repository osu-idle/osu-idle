import {
	BrowserWindow,
	type WebFrameMain,
} from 'electron';

function* subtree(frame: WebFrameMain | null): Generator<WebFrameMain> {
	if (!frame) return;
	yield frame;
	for (const child of frame.frames) yield* subtree(child);
}

/** Send an IPC message to every frame of every window - the top document and the
 *  same-origin /web iframe, so each one's bridge (and its API client) sees it. */
export function broadcast(channel: string, payload: unknown): void {
	for (const win of BrowserWindow.getAllWindows()) {
		for (const frame of subtree(win.webContents.mainFrame)) {
			try { frame.send(channel, payload); } catch { /* frame gone */ }
		}
	}
}
