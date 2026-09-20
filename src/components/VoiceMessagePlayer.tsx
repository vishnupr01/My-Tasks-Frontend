'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { PlayIcon, PauseIcon } from '@/components/Icons';

const BAR_COUNT = 24;

// Deterministic pseudo-waveform seeded from the URL -- the same voice message
// always renders the same "shape" instead of it jittering on every re-render.
// Not a real amplitude analysis of the audio (that would mean decoding the
// whole file client-side just to draw a picture), but visually it reads the
// same way a real waveform does, and progress fills across it for real.
// Pure per-bar noise reads as a flat gray blur -- layering a slow undulation
// (so neighboring bars trend together, like a real waveform's envelope)
// under per-bar jitter, with a wide height range, is what actually produces
// visible peaks and valleys instead of a flat row.
function seededBars(seed: string, count: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const phase = h % 1000;
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const jitter = ((h >>> 8) % 1000) / 1000; // 0..1, per-bar noise
    const envelope = (Math.sin((i / count) * Math.PI * 3 + phase) + 1) / 2; // 0..1, slow rolling shape
    const level = envelope * 0.65 + jitter * 0.35;
    bars.push(0.1 + level * 0.9); // wide range: near-flat to nearly full height
  }
  return bars;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface VoiceMessagePlayerProps {
  url: string;
  // Pre-formatted send time (e.g. "02:21 pm") -- shown on the same line as
  // the duration instead of as a separate line below, when provided.
  timestamp?: string;
  // Real duration in seconds, captured from our own recording timer at
  // send time. Browsers (Chrome in particular) frequently report Infinity
  // for the duration of a MediaRecorder-produced audio file -- the
  // container doesn't have an upfront duration header the way a normal
  // encoded file does -- and that's not reliably fixable client-side across
  // browsers/CDNs. Knowing the real value upfront sidesteps the problem
  // entirely, so it's always preferred over asking the <audio> element.
  knownDuration?: number;
}

export default function VoiceMessagePlayer({ url, timestamp, knownDuration }: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(knownDuration ?? 0);

  const bars = useMemo(() => seededBars(url, BAR_COUNT), [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnd = () => { setPlaying(false); setCurrentTime(0); };

    // Only ask the <audio> element for a duration if we don't already have
    // an authoritative one -- see the knownDuration doc comment above.
    const onLoaded = () => {
      if (knownDuration !== undefined) return;
      if (!Number.isFinite(audio.duration)) {
        const fixDuration = () => {
          audio.removeEventListener('timeupdate', fixDuration);
          setDuration(audio.duration);
          audio.currentTime = 0;
        };
        audio.addEventListener('timeupdate', fixDuration);
        audio.currentTime = 1e101;
      } else {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnd);
    };
  }, [knownDuration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const seekToFraction = (fraction: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const next = Math.min(1, Math.max(0, fraction)) * duration;
    audio.currentTime = next;
    setCurrentTime(next);
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="mt-1.5 w-72 max-w-full">
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />

      {/* Button and waveform are the only two items in this row, so
          items-center aligns the button against just the bars -- not
          against the bars-plus-time-label block below, which is what was
          pulling the waveform visually "up" relative to the button before. */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={togglePlay}
          title={playing ? 'pause' : 'play'}
          className="w-8 h-8 rounded-full bg-green-500 text-black flex items-center justify-center shrink-0 hover:bg-green-400 transition-colors"
        >
          {playing ? <PauseIcon className="w-3.5 h-3.5" /> : <PlayIcon className="w-3.5 h-3.5 ml-0.5" />}
        </button>

        <div
          className="flex-1 min-w-0 flex items-center gap-[2px] h-7 cursor-pointer"
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekToFraction((e.clientX - rect.left) / rect.width);
          }}
        >
          {bars.map((height, i) => {
            const played = i / bars.length < progress;
            return (
              <span
                key={i}
                className={`flex-1 min-w-[2px] rounded-full transition-colors ${played ? 'bg-green-400' : 'bg-green-900'}`}
                style={{ height: `${3 + height * 24}px` }}
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between mt-1 pl-[42px]">
        <span className="text-[10px] text-green-900 tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        {timestamp && <span className="text-[9px] text-green-900">{timestamp}</span>}
      </div>
    </div>
  );
}
