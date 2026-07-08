import { customType } from 'drizzle-orm/mysql-core';

/** drizzle's mysql `json()` never parses what mysql2 returns (a string over
 *  the prepared-statement protocol); this variant does. */
export const jsonColumn = <T>() =>
	customType<{ data: T; driverData: string }>({
		dataType: () => 'json',
		toDriver: value => JSON.stringify(value),
		fromDriver: value => (typeof value === 'string' ? JSON.parse(value) : value) as T,
	})();
