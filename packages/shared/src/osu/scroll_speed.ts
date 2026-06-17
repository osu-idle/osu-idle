const MAX_TIME_RANGE = 11485;

export const scrollSpeedToMs = (ss: number): number => MAX_TIME_RANGE / ss;
export const msToScrollSpeed = (ms: number): number => MAX_TIME_RANGE / ms;