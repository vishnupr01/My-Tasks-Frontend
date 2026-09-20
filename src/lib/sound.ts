let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

// Synthesized two-note blip -- no audio file to ship, license, or fetch.
// Browsers block audio before the user has interacted with the page at all;
// by the time a chat message can arrive the user has already logged in and
// clicked around, so the context is unlocked in practice. If it isn't yet,
// resume() rejects quietly and we just skip the sound for that one message.
export function playNotificationSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  const notes: { freq: number; start: number; duration: number }[] = [
    { freq: 880, start: 0, duration: 0.09 },
    { freq: 1320, start: 0.09, duration: 0.13 },
  ];

  for (const { freq, start, duration } of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.15, now + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + duration + 0.02);
  }
}
