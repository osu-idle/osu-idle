# @osu-idle/desktop

The Electron shell that runs the game client as a standalone PC app. Its reason
to exist: browsers throttle (and eventually pause) hidden tabs - rAF stops,
timers are clamped, the `AudioContext` can suspend - which desyncs spectated
plays and stalls autopilot. The shell sets `backgroundThrottling: false`, so the
gameplay clock, render loop, and audio keep running whether or not the window is
focused.

## How it fits the monorepo

- **Renderer = the existing builds.** It does not fork the client. The compiled
  `@osu-idle/client` (and `@osu-idle/web`) bundles are served from a registered
  `app://idle` scheme (standard + secure → stable origin, secure context,
  IndexedDB persists). The `/web` profile platform stays a same-origin iframe.
- **Only the app shell ships.** The on-demand static library (`beatmaps/`,
  `previews/` - ~2.4 GB) is **not** bundled; the `app://` handler proxies those
  paths to the website (`config.ts` `REMOTE_PREFIXES`), the same URLs the browser
  hits. Keeps the installer small and within NSIS's limits. Excluded from the
  copy via `extraResources.filter` in `electron-builder.yml`.
- **API = the public server, over Bearer.** An `app://` origin can't ride the
  HttpOnly session cookie, so the app holds the session token and the client/web
  API layers send it as `Authorization: Bearer`. The server accepts that
  alongside the cookie (`requireAuth`), so the website is unaffected.

## osu! OAuth (native flow)

Sign-in runs in the user's **real system browser** (no embedded webview). The
browser can't hand a cookie or a custom-scheme deep link back to the app (some
browsers, e.g. Firefox, block the latter outright), so the app **polls** the
server for the result, keyed by a one-time code it generated:

1. Renderer calls `window.osuIdleDesktop.login()` → main generates a one-time
   `poll` code and opens `…/v1/auth/osu/login?client=desktop&poll=<code>` in the
   system browser. It then polls `POST /v1/auth/osu/desktop/exchange` for that
   code every ~1.5s (up to 5 min).
2. osu! → server callback. The `client=desktop` tag and the `poll` code (both
   carried in the signed CSRF state) make the callback stash the session under
   the poll code and show a "you can close this tab" page.
3. The app's next poll redeems the code for the token (HTTPS, single-use), stores
   it (encrypted, `safeStorage`), and pushes it to every frame.
4. The bridge fires `onAuthChanged`; the client re-resolves its session and the
   /web iframe re-reads `/auth/me`.

The long-lived token never travels in a URL (only the one-time code does). **No
new osu! redirect URI is needed** - osu! still calls the same server callback.

## Build & run

Prereq: `npm install` at the repo root (pulls Electron + electron-builder).

```bash
# Dev: run the usual `npm run dev` (vite client :5173 + server :3873), then:
npm run dev:desktop          # compiles main/preload and launches Electron at :5173

# Package installers (builds shared → server types → client → web → main, then
# electron-builder). NOTE: building client/web also deploys them (see root CLAUDE.md).
npm run dist:desktop
```

Dev talks to the local server (`localhost:3873`) and loads the live Vite client;
packaged builds talk to the public API and load the bundled `app://idle` origin.
Deep links in dev require the protocol to point back at the dev Electron binary -
`main.ts` handles that automatically. The `osu-idle://` scheme is registered and
routed (see deeplink.ts) but currently carries no actions - it's kept as the
transport for future app-directed links.

## Self-update

Packaged builds update via `electron-updater` over a **generic** feed (the
`publish` block in `electron-builder.yml` → the website's `/download`). The build
bundles `app-update.yml`, so the app finds the feed with no extra wiring. Update
is **user-initiated**, reusing the client's existing version poll:

1. The client already polls the server version every few seconds. When it sees a
   newer one **and** it's the desktop app, it calls `osuIdleDesktop.update.check()`
   instead of the browser's "refresh to update" prompt.
2. The in-game `DesktopUpdate` banner (client) shows *Download* → progress →
   *Restart & install*, driven by `update.onStatus` and ending in `quitAndInstall`.

`autoDownload` is off (the player chooses); a fetched update also auto-applies on
the next quit. Auto-update only runs in packaged builds. **Signing note:** macOS
auto-update requires a signed + notarized app; Windows NSIS updates work unsigned
(with a SmartScreen prompt) - sign for production.

## Discord Rich Presence

Shows what the player is up to on their Discord profile (the current scene, or
the map being played with an elapsed timer). It's **renderer-driven and
self-healing**, so there's almost nothing to manage:

1. The client's `online/presence.ts` watches the live scene (`SceneManager`) and
   the playing map (`music.beatmap`) and pushes a small `DesktopPresence` snapshot
   through the bridge - `osuIdleDesktop.setPresence(...)`. Inert in a browser.
2. `presence.ts` (main) speaks Discord's local IPC protocol directly (no
   dependency - just the documented opcode+length framing over the
   `discord-ipc-*` socket). It connects lazily, remembers the last snapshot, and
   reconnects on its own, so the renderer can fire-and-forget whether or not
   Discord is running.

**Setup (one-time):** create an app at the [Discord Developer Portal](https://discord.com/developers/applications),
upload a Rich Presence art asset (default key `logo`), and paste its Application
ID into `DISCORD_CLIENT_ID` in `config.ts`. Leave it empty to disable presence
entirely - everything no-ops. To label a new scene, add a case to `sceneLabel`
in the client's `presence.ts`; the Discord plumbing here never changes.

## Publishing (part of a full deploy)

`deploy:prod` ends with `npm run publish:desktop`, which builds the Linux
(AppImage) + Windows (NSIS, via Wine) installers, then `scripts/publish-desktop.mjs`
copies `osu-idle.exe` / `osu-idle.AppImage` + the `latest*.yml` feed and a
`manifest.json` (version + filenames, read by the web *Play osu!idle* page) into
the download dir. Stable filenames + a single `latest` channel
(`detectUpdateChannel: false`), so the URL never changes and auto-update always
sees the next build. So every release also refreshes the download.

**Where it lands (no config needed):** the site's Apache DocumentRoot is
`packages/client/dist`, so `/download` is just `dist/download`. Like
`beatmaps`/`previews`, the durable copy lives in `client/public/download`
(re-emitted to `dist` on every client build, so a later `newmap` never wipes it);
it's also dropped straight into the current `dist/download` so the deploy serves
the new build immediately. Override with `DESKTOP_PUBLISH_DIR` to publish to one
explicit path instead. The desktop bundle excludes `download/**` (like
beatmaps/previews) so the installers never recurse into the app.

Cross-building the Windows `.exe` from Linux needs **Wine** (the `dist` script
runs in the `electronuserland/builder:wine` Docker image). macOS installers can't
be cross-built from Linux - add them via a Mac or CI runner later (electron-builder
`--mac`); the manifest already tolerates a missing macOS file.

## Steam (later)

The app is **not** Steam-coupled: `window.osuIdleDesktop.steam` is an inert
feature-detect stub today. Wiring Steamworks (overlay, achievements, cloud saves,
rich presence) means adding `steamworks.js` in the main process and filling that
namespace - no change to the auth or rendering paths.
