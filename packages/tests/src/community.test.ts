import {
	describe,
	it,
	expect,
} from 'vitest';
import {
	clientMessage,
	serverMessage,
	chatLineDTO,
} from '@osu-idle/shared/community/wire';
import { presenceEntryDTO } from '@osu-idle/shared/community/presence';
import { firstPlaceMessage } from '@osu-idle/shared/community/announcements';

describe('community wire contract', () => {
	it('round-trips a presence entry', () => {
		const entry = {
			characterId: 7,
			name: 'tester',
			avatarUrl: 'https://example.com/a.png',
			country: 'FR',
			rank: 42,
			pp: 1234.5,
			accuracy: 0.987,
			playCount: 321,
			level: 50,
			status: 'playing' as const,
			nowPlaying: 'Artist - Title',
			loc: {
				x: 0.5, y: 0.25,
			},
			tz: 'Europe/Paris',
		};
		expect(presenceEntryDTO.parse(entry)).toEqual(entry);
	});

	it('accepts a minimal presence entry (optionals omitted)', () => {
		const entry = {
			characterId: 1,
			name: 'guestless',
			avatarUrl: 'x',
			country: 'JP',
			pp: 0,
			accuracy: 0,
			playCount: 0,
			level: 0,
			status: 'idle' as const,
		};
		expect(presenceEntryDTO.parse(entry)).toEqual(entry);
	});

	it('rejects an unknown status', () => {
		expect(presenceEntryDTO.safeParse({
			characterId: 1, name: 'x', avatarUrl: 'x', country: 'x',
			pp: 0, accuracy: 0, playCount: 0, level: 0, status: 'sleeping',
		}).success).toBe(false);
	});

	it('parses each client message variant and rejects bad ones', () => {
		expect(clientMessage.safeParse({
			type: 'chat', channel: '#osu!idle', text: 'hi',
		}).success).toBe(true);
		expect(clientMessage.safeParse({
			type: 'status', status: 'afk',
		}).success).toBe(true);
		// playing is server-only, never a client-reported status
		expect(clientMessage.safeParse({
			type: 'status', status: 'playing',
		}).success).toBe(false);
		// empty chat text is rejected
		expect(clientMessage.safeParse({
			type: 'chat', channel: '#osu!idle', text: '',
		}).success).toBe(false);
	});

	it('round-trips a player chat message', () => {
		const msg = {
			type: 'chat' as const,
			line: {
				kind: 'player' as const,
				channel: '#osu!idle',
				from: {
					characterId: 3, name: 'someone', color: '#fa81c6',
				},
				text: 'hello',
				at: 1_700_000_000_000,
			},
		};
		expect(serverMessage.parse(msg)).toEqual(msg);
		expect(chatLineDTO.parse(msg.line)).toEqual(msg.line);
	});

	it('round-trips a system chat message (no sender)', () => {
		const line = {
			kind: 'system' as const,
			channel: '#osu!idle',
			color: '#fa81c6',
			text: 'someone achieved rank #1 on Artist - Title [Hard]',
			at: 1_700_000_000_000,
		};
		expect(chatLineDTO.parse(line)).toEqual(line);
	});
});

describe('first-place announcement', () => {
	const beatmap = {
		artist: 'Camellia', title: 'Ghost', version: 'Insane',
	};

	it('formats a regular #1', () => {
		expect(firstPlaceMessage('Adri', beatmap, false))
			.toBe('Adri achieved rank #1 on Camellia - Ghost [Insane]');
	});

	it('formats a perfect (1M) #1', () => {
		expect(firstPlaceMessage('Adri', beatmap, true))
			.toBe('Adri achieved a perfect rank #1 on Camellia - Ghost [Insane]');
	});
});
