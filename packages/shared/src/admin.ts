/**
 * Accounts allowed to publish and edit news (and any future admin-only action).
 * Shared so the server can guard routes and the web can decide whether to show
 * the editor UI off the same source of truth.
 */
export const ADMIN_USER_IDS: readonly number[] = [4579132];

export function isAdmin(userId: number | null | undefined): boolean {
	return userId != null && ADMIN_USER_IDS.includes(userId);
}
