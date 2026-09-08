import {
	expect,
	type Locator,
	type Page,
} from '@playwright/test';
import type {
	CatalogEntry,
	CatalogVersion,
	CharacterView,
	PlayView,
	QueueView,
	Scene,
	ScoreView,
	XPGainView,
} from './bridge';

/** A difficulty a test plays, with the set it came from. */
export type PickedMap = { set: CatalogEntry, version: CatalogVersion };

/** How long the intro holds before it hands over to the menu, plus slack. */
const INTRO_MS = 8_000;

/**
 * The game, as a test drives it.
 *
 * Everything a player does here is a real click on the real UI. The dev bridge
 * is used for two things only: reading state the DOM does not spell out (the
 * character's xp, the local score rows), and ending a running play now - a play
 * is a clock, and a suite that waited songs out would take an hour.
 */
export default class Game {

	constructor(public readonly page: Page) {}

	/** Load the client and wait for the dev bridge and the resolved session. */
	async open(): Promise<void> {
		await this.page.goto('/');
		await this.page.waitForFunction(() => !!window.__idle, undefined, { timeout: 60_000 });
		await this.page.waitForFunction(
			() => window.__idle!.sessionReady(), undefined, { timeout: 60_000 },
		);
	}

	/** Click through the intro to the main menu. */
	async enterMenu(): Promise<void> {
		const intro = this.page.locator('.intro');
		await expect(intro).toBeVisible();
		await intro.click();
		await expect(this.page.locator('.menu')).toBeVisible({ timeout: INTRO_MS });
		await this.expectScene('MENU');
	}

	/** Main menu → Play → Solo, the way a player reaches song select. */
	async enterSongSelect(): Promise<void> {
		await this.page.locator('.menu__logo-enter').click();
		await this.menuOption('Play').click();
		await this.menuOption('Solo').click();
		await expect(this.page.locator('.game')).toBeVisible();
		await this.expectScene('SELECT');
	}

	/** Intro → menu → song select in one go. */
	async start(): Promise<void> {
		await this.open();
		await this.enterMenu();
		await this.enterSongSelect();
	}

	menuOption(title: string): Locator {
		return this.page.locator('.menu__option.visible', { hasText: title }).first();
	}

	async scene(): Promise<Scene> {
		return this.page.evaluate(() => window.__idle!.scene());
	}

	async expectScene(scene: Scene, timeout = 30_000): Promise<void> {
		await this.page.waitForFunction(
			(want) => window.__idle!.scene() === want, scene, { timeout },
		);
	}

	// --- library ---------------------------------------------------------

	/** The catalog, shortest set first. */
	async catalog(): Promise<CatalogEntry[]> {
		return this.page.evaluate(() => window.__idle!.catalog());
	}

	/**
	 * The easiest short 4K difficulty the catalog has.
	 *
	 * A fresh guest's skills are all at level zero, and a level-zero bot fails
	 * anything demanding - a failed play saves nothing and pays nothing, which
	 * is not what most of these tests are about. So they play the easiest map
	 * there is, and the failure path gets a map picked for it.
	 */
	async easiestMap(maxLengthMs = 150_000): Promise<PickedMap> {
		return this.pickMap((a, b) => a.difficulty - b.difficulty, maxLengthMs);
	}

	/** The hardest map, for the paths a failed play takes. */
	async hardestMap(maxLengthMs = 150_000): Promise<PickedMap> {
		return this.pickMap((a, b) => b.difficulty - a.difficulty, maxLengthMs);
	}

	private async pickMap(
		order: (a: CatalogVersion, b: CatalogVersion) => number,
		maxLengthMs: number,
	): Promise<PickedMap> {
		const sets = await this.catalog();
		const candidates = sets.flatMap(set => set.versions
			.filter(v => v.mode === 3 && v.keys === 4 && v.length <= maxLengthMs)
			.map(version => ({
				set, version,
			})));
		const pick = candidates.sort((a, b) => order(a.version, b.version))[0];
		if (!pick) throw new Error('the catalog has no playable 4K map to pick');
		return pick;
	}

	/** Put a set in the local store without going through the carousel, for
	 *  tests whose subject is not the download. Returns its difficulty ids. */
	async install(setId: number): Promise<number[]> {
		return this.page.evaluate((id) => window.__idle!.download(id), setId);
	}

	/** Install the easiest map there is, ready to be searched for and played. */
	async installEasiest(maxLengthMs = 150_000): Promise<PickedMap> {
		const pick = await this.easiestMap(maxLengthMs);
		await this.install(pick.set.id);
		return pick;
	}

	async installedSets(): Promise<number[]> {
		return this.page.evaluate(() => window.__idle!.sets());
	}

	/** Type into song select's search box and let the list settle. */
	async search(text: string): Promise<void> {
		await this.page.locator('.songsearch__input').fill(text);
		await this.page.waitForTimeout(400);
	}

	card(diffId: number): Locator {
		return this.page.locator(`.bm-card[data-id="${diffId}"]`);
	}

	/**
	 * Scroll the carousel until a difficulty's card is mounted.
	 *
	 * Only a window of rows exists in the DOM at a time, so a card further down
	 * the list is not hidden - it is not there at all until the list is scrolled
	 * to it.
	 */
	async revealCard(diffId: number, timeout = 30_000): Promise<void> {
		const card = this.card(diffId);
		const carousel = this.page.locator('.carousel');
		await expect(carousel).toBeVisible();
		await carousel.evaluate((el) => { el.scrollTop = 0; });
		const until = Date.now() + timeout;
		for (;;) {
			if (await card.count()) return;
			const stuck = await carousel.evaluate((el) => {
				const before = el.scrollTop;
				el.scrollTop = Math.min(el.scrollTop + el.clientHeight * 0.75, el.scrollHeight);
				return el.scrollTop === before;
			});
			await this.page.waitForTimeout(150);
			if (await card.count()) return;
			if (stuck || Date.now() > until) {
				throw new Error(`no card for difficulty ${diffId} in the carousel`);
			}
		}
	}

	/** Bring a difficulty's card on screen and select it (one click). */
	async selectCard(diffId: number): Promise<void> {
		await this.revealCard(diffId);
		const card = this.card(diffId);
		await expect(card).toBeVisible();
		await card.click();
		await expect(card).toHaveClass(/is-active/);
	}

	/**
	 * Select, then click again - which is how song select starts a play.
	 *
	 * The second click only launches once the carousel has reloaded the library
	 * and the card is backed by a downloaded map; before that it just selects.
	 * So it clicks until the play is under way, which is what a player does.
	 */
	async playCard(diffId: number, timeout = 60_000): Promise<void> {
		await this.selectCard(diffId);
		const until = Date.now() + timeout;
		for (;;) {
			await this.card(diffId).click();
			try {
				await this.expectScene('GAME', 3_000);
				return;
			} catch (e) {
				if (Date.now() > until) throw e;
			}
		}
	}

	/**
	 * Queue a map from song select in queue mode.
	 *
	 * Only a downloaded map can wait in the queue, and the carousel may still be
	 * showing the catalog's copy of it when the click lands - so it clicks until
	 * the map is in the queue, the way a player would.
	 */
	async queueCard(diffId: number, timeout = 30_000): Promise<void> {
		await this.selectCard(diffId);
		const queued = async () =>
			!!(await this.queue())?.entries.some(e => e.id === diffId);
		const until = Date.now() + timeout;
		for (;;) {
			await this.card(diffId).click();
			await this.page.waitForTimeout(300);
			if (await queued()) return;
			if (Date.now() > until) throw new Error(`map ${diffId} never reached the queue`);
		}
	}

	/** Enter plays the selected map - the keyboard path song select offers, and
	 *  the way in when something is covering the carousel. */
	async playSelected(): Promise<void> {
		await this.page.keyboard.press('Enter');
		await this.expectScene('GAME');
	}

	// --- plays -----------------------------------------------------------

	async play(): Promise<PlayView | undefined> {
		return this.page.evaluate(() => window.__idle!.play());
	}

	/** Wait until a play is live (in any scene). */
	async waitForPlay(timeout = 90_000): Promise<PlayView> {
		await this.page.waitForFunction(
			() => !!window.__idle!.play(), undefined, { timeout },
		);
		return (await this.play())!;
	}

	async waitForNoPlay(timeout = 60_000): Promise<void> {
		await this.page.waitForFunction(
			() => !window.__idle!.play(), undefined, { timeout },
		);
	}

	/** The gameplay scene's dev "skip to end": the play resolves where it stands
	 *  and hands over to the result screen. What a developer clicks, and the only
	 *  way to end a play being *watched* without sitting through the song. */
	async skipToEnd(): Promise<void> {
		await this.page.locator('.play__skip').click();
	}

	/** End the play the local session owns, from outside the playfield - for a
	 *  play running in the background, where no scene is watching. Its outcome
	 *  was decided when it started, so this is the score waiting it out would
	 *  have produced. */
	async finishPlay(): Promise<void> {
		const ended = await this.page.evaluate(() => window.__idle!.finishPlay());
		expect(ended, 'no local play was running to finish').toBe(true);
	}

	// --- state -----------------------------------------------------------

	async character(): Promise<CharacterView> {
		return this.page.evaluate(() => window.__idle!.character());
	}

	async scores(): Promise<ScoreView[]> {
		return this.page.evaluate(() => window.__idle!.scores());
	}

	/** The result screen comes up off the play's outcome, which the owner
	 *  finishes booking (pp, the score row, the xp) a moment later. */
	async waitForScores(count = 1, timeout = 60_000): Promise<ScoreView[]> {
		await expect.poll(
			async () => (await this.scores()).length,
			{
				timeout, message: `waiting for ${count} saved score(s)`,
			},
		).toBeGreaterThanOrEqual(count);
		return this.scores();
	}

	async xpGains(): Promise<XPGainView[]> {
		return this.page.evaluate(() => window.__idle!.xpGains());
	}

	async queue(): Promise<QueueView | undefined> {
		return this.page.evaluate(() => window.__idle!.queue());
	}

	async countdown(): Promise<number | undefined> {
		return this.page.evaluate(() => window.__idle!.countdown());
	}

	async setting(key: string): Promise<unknown> {
		return this.page.evaluate((k) => window.__idle!.setting(k), key);
	}

}
