/**
 * Shared, render-free channel for the osu! logo's live pulse scale.
 * OsuLogo writes it every animation frame; LogoVisualizer reads it so the
 * waveform's radius hugs the logo as it breathes and beats. Kept off React
 * state on purpose - this updates at 60fps and must not trigger re-renders.
 */
export const logoPulse = { scale: 1 };
