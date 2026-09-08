import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import type { MapRequest } from '../../api/mapRequests';

/**
 * What a request looks like to a player. The row's own status only says whether
 * an admin has answered it; everything past that is read off the beatmapset the
 * ingest created, so a request keeps reporting the map's real progress -
 * queued for nomination, scheduled, then ranked.
 */
export type RequestPhase = 'open' | 'accepted' | 'queued' | 'scheduled' | 'ranked' | 'rejected';

export const phaseOf = (row: MapRequest): RequestPhase => {
	if (row.status === 'rejected') return 'rejected';
	if (row.status === 'pending') return 'open';
	if (!row.setStatus) return 'accepted';
	if (row.setStatus !== 'ranked') return 'queued';
	return row.rankedAt && new Date(row.rankedAt).getTime() <= Date.now() ? 'ranked' : 'scheduled';
};

export const PHASE_LABEL: Record<RequestPhase, MessageDescriptor> = {
	open: msg`open`,
	accepted: msg`accepted`,
	queued: msg`in nomination`,
	scheduled: msg`scheduled`,
	ranked: msg`ranked`,
	rejected: msg`rejected`,
};
