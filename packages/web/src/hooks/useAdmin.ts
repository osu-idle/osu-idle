import { useCurrentUser } from './useCurrentUser';

export function useAdmin(): boolean {
	const user = useCurrentUser();

	return !!user && user.id === 4579132;
}
