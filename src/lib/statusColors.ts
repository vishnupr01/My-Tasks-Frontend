// Online/offline indicator colors, driven by the --status-online /
// --status-offline CSS variables (globals.css) so each theme can pick its
// own -- the hacker theme uses cyan since its palette is already all green,
// normal/dark keep the conventional green. Defined once here so every
// component that shows a status dot stays in sync.
export const ONLINE_COLOR = 'rgb(var(--status-online))';
export const OFFLINE_COLOR = 'rgb(var(--status-offline))';

// Recording waveform bars -- green in the hacker theme (its native palette),
// blue in normal/dark, driven by --wave-color per theme.
export const WAVE_COLOR = 'rgb(var(--wave-color))';
