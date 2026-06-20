import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { DESKTOP_SCHEME, IS_DEV, RENDERER_URL, iconPath } from './config';
import { registerAppProtocol, registerAppSchemePrivileges } from './protocol';
import { getToken, loadToken, logout, startLogin } from './auth';
import { handleDeepLink } from './deeplink';
import { checkForUpdate, downloadUpdate, initUpdater, installUpdate } from './update';
import { destroyPresence, initPresence, setPresence } from './presence';
import type { DesktopPresence } from '@osu-idle/shared/desktop' with { 'resolution-mode': 'import' };

// Privileges must be declared before the app is ready.
registerAppSchemePrivileges();

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
	mainWindow = new BrowserWindow({
		width: 1280,
		height: 800,
		minWidth: 1024,
		minHeight: 640,
		icon: iconPath(),
		backgroundColor: '#05040a',
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false,
			// run the preload (and thus the bridge) inside the same-origin /web
			// iframe too, so the in-game profile platform is Bearer-authed as well.
			nodeIntegrationInSubFrames: true,
			sandbox: false,
			// the entire reason for the desktop build: keep the gameplay clock,
			// render loop, and audio running while the window is unfocused/hidden.
			backgroundThrottling: false,
			// a real app, not a browser tab: let music start on the intro without a
			// click gate (the renderer auto-activates the intro when standalone).
			autoplayPolicy: 'no-user-gesture-required',
		},
	});

	// target='_blank' links (e.g. discord/github) must open in the player's real
	// browser, not a chromeless Electron window.
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		if (/^https?:\/\//.test(url)) void shell.openExternal(url);
		return { action: 'deny' };
	});

	void mainWindow.loadURL(RENDERER_URL);
	if (IS_DEV) mainWindow.webContents.openDevTools({ mode: 'detach' });
	mainWindow.on('closed', () => { mainWindow = null; });
	// mirror native fullscreen changes (F11 / OS) back to the renderer so the
	// in-game setting stays truthful.
	mainWindow.on('enter-full-screen', () => mainWindow?.webContents.send('osu-idle:fullscreen', true));
	mainWindow.on('leave-full-screen', () => mainWindow?.webContents.send('osu-idle:fullscreen', false));
}

function focusWindow(): void {
	if (!mainWindow) return;
	if (mainWindow.isMinimized()) mainWindow.restore();
	mainWindow.focus();
}

/** A deep link (`osu-idle://...`) sitting in a process argv list, if any. */
function deepLinkFromArgv(argv: string[]): string | undefined {
	return argv.find(arg => arg.startsWith(`${DESKTOP_SCHEME}://`));
}

/** Register as the OS handler for the custom scheme. In dev, Electron is launched
 *  via the `electron` binary + our script path, so the handler must point back at
 *  exactly that for the OS to route the deep link to this instance. */
function registerProtocolClient(): void {
	if (process.defaultApp && process.argv.length >= 2) {
		app.setAsDefaultProtocolClient(DESKTOP_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
	} else {
		app.setAsDefaultProtocolClient(DESKTOP_SCHEME);
	}
}

// Single-instance: a second launch (how Windows/Linux deliver a deep link)
// forwards its URL to the already-running app instead of starting a second one.
if (!app.requestSingleInstanceLock()) {
	app.quit();
} else {
	app.on('second-instance', (_event, argv) => {
		const link = deepLinkFromArgv(argv);
		if (link) handleDeepLink(link);
		focusWindow();
	});

	// macOS delivers the deep link through this event rather than argv.
	app.on('open-url', (event, url) => {
		event.preventDefault();
		handleDeepLink(url);
		focusWindow();
	});

	void app.whenReady().then(() => {
		loadToken();
		registerProtocolClient();
		registerAppProtocol();

		// Bridge IPC. `bootstrap` is synchronous so the preload can seed the token
		// before the renderer's first API call (no signed-out flash on launch).
		ipcMain.on('osu-idle:bootstrap', event => {
			event.returnValue = { token: getToken(), version: app.getVersion() };
		});
		ipcMain.handle('osu-idle:login', () => startLogin());
		ipcMain.handle('osu-idle:logout', () => { logout(); });
		ipcMain.on('osu-idle:set-fullscreen', (_event, on: boolean) => mainWindow?.setFullScreen(!!on));
		ipcMain.on('osu-idle:quit', () => app.quit());

		// Self-update IPC. install ends the app, so it's fire-and-forget (send).
		initUpdater();
		ipcMain.handle('osu-idle:update-check', () => checkForUpdate());
		ipcMain.handle('osu-idle:update-download', () => downloadUpdate());
		ipcMain.on('osu-idle:update-install', () => installUpdate());

		// Discord Rich Presence. The renderer pushes scene/map changes; the client
		// is self-healing, so this is fire-and-forget too.
		initPresence();
		ipcMain.on('osu-idle:presence', (_event, presence: DesktopPresence | null) => setPresence(presence));

		createWindow();

		// A deep link passed on first launch (cold start via the protocol) rides in
		// this process's argv on Windows/Linux.
		const initial = deepLinkFromArgv(process.argv);
		if (initial) handleDeepLink(initial);

		app.on('activate', () => {
			if (BrowserWindow.getAllWindows().length === 0) createWindow();
		});
	});

	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') app.quit();
	});

	app.on('before-quit', () => destroyPresence());
}
