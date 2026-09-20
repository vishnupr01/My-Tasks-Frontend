// Deterministic per-user color for usernames in a multi-person chat (channels),
// so different senders stay visually distinguishable at a glance. Same input
// always produces the same color -- no per-user color needs to be stored.
export function userColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 60%)`;
}
