import {
	ControlPointInfo,
	ControlPointGroup,
} from 'osu-classes';

/**
 * osu-classes' `ControlPointInfo.groupAt` does a linear `.find` *and a full
 * `.sort()` of the whole group list on every control-point insertion* - so
 * decoding is O(n² log n) in the number of control points. Most maps have a
 * handful, but SV-heavy maps carry tens of thousands (Camellia – Singularity
 * has ~23 400 timing points), which turns a single decode into a multi-second
 * main-thread stall - felt as a freeze when the map is selected on the client
 * and as multi-second play setup on the server.
 *
 * This replaces `groupAt` with an O(1) map lookup plus a binary-search sorted
 * insert (no full re-sort), bringing that same decode from ~3.6s to ~70ms. The
 * `groups` array stays sorted and identical to before; behaviour is unchanged.
 *
 * Imported for side effect at every decode site. Idempotent and self-healing:
 * the time→group index is rebuilt whenever it falls out of sync with `groups`
 * (e.g. after `clear()` empties the list).
 */

 
type Patchable = ControlPointInfo & { __groupMap?: Map<number, ControlPointGroup> };

ControlPointInfo.prototype.groupAt = function (
	this: Patchable, 
	time: number,
): ControlPointGroup {
	let map = this.__groupMap;
	if (!map || map.size !== this.groups.length) {
		map = this.__groupMap = new Map(this.groups.map((g) => [g.startTime, g]));
	}

	let group = map.get(time);
	if (!group) {
		group = new ControlPointGroup(time);
		map.set(time, group);
		// insert keeping `groups` ascending by startTime, without re-sorting
		const groups = this.groups;
		let lo = 0;
		let hi = groups.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (groups[mid].startTime < time) lo = mid + 1;
			else hi = mid;
		}
		groups.splice(lo, 0, group);
	}
	return group;
};
