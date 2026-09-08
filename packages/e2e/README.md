# @osu-idle/e2e

The end-to-end suite: a real browser, the real dev stack, and scenarios played
the way a player plays them.

It is deliberately **not** part of `npm test`. The vitest suite
(`@osu-idle/tests`) is node-only - it never mounts a React scene, never opens a
socket and never runs the play protocol, so a green run there says nothing about
any of that. This is where those live, and it costs minutes rather than seconds.

```bash
npm run teste2e            # run it (headless chromium)
npm run teste2e:headed     # watch it happen
npm run teste2e:ui         # playwright's UI mode, for writing tests
npm run teste2e:report     # open the last HTML report
npm run teste2e:install    # one-off: download the browser
```

## What it runs against

The **dev** stack: the client on `:5173` (which proxies `/web` to the web app on
`:5174`) against the API on `:3873`. `npm run dev` is usually already running and
is reused; when it is not, playwright starts it.

Every test opens a fresh browser context, so the local sql.js database, the
IndexedDB behind it and the settings all start empty - each test is a first-run
player, signed out. Nothing here signs in: the account path goes through osu!
OAuth, and the guest path is where the whole idle loop can be exercised without
it.

## How a test drives the game

Clicks, keys and the DOM - `src/support/game.ts` is the page object, and the
specs read as what a player did. Two things are read through the client's
dev-only bridge (`packages/client/src/dev/testBridge.ts`, on `window.__idle`
behind `import.meta.env.DEV`):

- **state the screen does not spell out** - the character's xp, the local score
  rows, what is in the queue;
- **ending a play now**. A play is a clock over an outcome decided when it
  started, so a suite that waited songs out would take an hour. Watching a play,
  a test clicks the dev **skip to end** the playfield already offers; for a play
  running in the background it calls `finishPlay()`, which is the same thing the
  local session's own timer would have done.

Two fixtures set that up: `game` (the page object) and `errors` (everything the
page logged, so a spec can assert it stayed quiet).

## The specs

| file | what it covers |
|---|---|
| `boot.spec.ts` | intro → menu → song select, the guest character, the catalog |
| `play.spec.ts` | download a set, play it, the result screen, what a pass saves and a fail doesn't |
| `background.spec.ts` | quitting leaves the play running, it pays with nobody watching, aborting throws it away, the dock watches it back |
| `queue.spec.ts` | queue mode, ordering from the dock, chaining the next map |
| `progression.spec.ts` | levels from a play, buying an upgrade, what it costs, surviving a reload |
| `persistence.spec.ts` | scores, xp, library and settings across a reload - and the queue deliberately not surviving one |
| `community.spec.ts` | F9 / F8 overlays, the world map, auto-hide around gameplay |
| `options.spec.ts` | the options overlay, its search, a toggle that sticks |
| `web.spec.ts` | the web platform under `/web`: landing, rankings, maps, news |
| `playground.spec.ts` | every `?playground` case renders, with nothing logged |

## Writing one

- Prefer a click over the bridge. The bridge is for what a click cannot say.
- The carousel is virtualised: a card that is not on screen is not in the DOM.
  `revealCard` scrolls to it - `selectCard` and `playCard` already do.
- A fresh character is level zero and fails anything demanding, so a test that
  needs a passed play uses `installEasiest()`. `hardestMap()` is there for the
  failure path.
- The dock's row controls and the shift-to-skip-confirm buy button appear on
  hover / on keydown: hover (or hold the key) first, then click.
