import { rpc } from './client';

export const logout = () => rpc.v1.auth.logout.$post();
