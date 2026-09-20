// Where the backend lives, worked out at runtime instead of being baked
// into .env.local.
//
// The reason: this machine's LAN IP is handed out by the router's DHCP and
// changes on its own (it has gone 192.168.10.2 -> .4 -> 192.168.1.6 -> .4
// during development). Any IP written into an env file is therefore wrong
// the moment that happens, and the symptom is horrible to diagnose -- the
// pages still load, but every API call quietly fails, so the app just
// looks empty.
//
// Deriving the host from the page's own URL removes the problem entirely:
// open the app on localhost and it calls localhost, open it on a phone via
// the LAN IP and it calls that same IP. Nothing to keep in sync.
//
// NEXT_PUBLIC_API_URL still wins when set, for the case the backend really
// does live somewhere else (a deployed environment).
const API_PORT = 3001;

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured;

  // Server-side render: no window, and nothing here fetches during SSR
  // anyway -- this is only a sane fallback.
  if (typeof window === 'undefined') return `http://localhost:${API_PORT}`;

  return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
}
