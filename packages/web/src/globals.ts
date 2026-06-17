import Synced from '@osu-idle/shared/helpers/synced';
import { Blackout } from './components/Blackout';


export const debugMode = new Synced(import.meta.env.DEV);

export const pageTitle = new Synced('');

export const blackout = new Blackout();