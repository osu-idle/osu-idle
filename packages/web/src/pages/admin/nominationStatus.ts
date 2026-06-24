import type { Nomination } from '../../api/maps';

/** Display phase of a queue entry, derived from status + ranked date. A 'ranked'
 *  set is 'scheduled' until its date passes, then 'live'. */
export type Phase = 'pending' | 'scheduled' | 'live' | 'rejected';

export const phaseOf = (row: Nomination): Phase => {
	if (row.status === 'rejected') return 'rejected';
	if (row.status === 'pending') return 'pending';
	return row.rankedAt && new Date(row.rankedAt).getTime() <= Date.now() ? 'live' : 'scheduled';
};

/** A live map is already public: its date is fixed and most actions are closed. */
export const isLive = (row: Nomination): boolean => phaseOf(row) === 'live';

export const PHASE_ORDER: Record<Phase, number> = {
	pending: 0, scheduled: 1, live: 2, rejected: 3, 
};
