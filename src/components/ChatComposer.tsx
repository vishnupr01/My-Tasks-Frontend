'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { uploads as uploadsApi, type SendMessagePayload, type UploadResult } from '@/lib/api';
import { PaperclipIcon, MicIcon, StopIcon, SendIcon, PlayIcon, PauseIcon, TrashIcon, XIcon } from '@/components/Icons';
import { WAVE_COLOR } from '@/lib/statusColors';

interface ChatComposerProps {
  placeholder: string;
  onSend: (payload: SendMessagePayload, replaceTempId?: string) => Promise<void>;
  // Called synchronously the instant a voice note is finalized -- before the
  // upload even starts -- so the page can show the message right away using
  // the local (not-yet-uploaded) recording instead of waiting on the full
  // upload + save round trip. tempId correlates with the eventual onSend
  // call so the page can swap the placeholder for the real, server-saved
  // message once it lands.
  onOptimisticSend?: (tempId: string, preview: { url: string; durationSeconds: number; name: string }) => void;
  // Called if the upload/send ultimately fails, so the page can remove the
  // optimistic placeholder it added.
  onOptimisticFailed?: (tempId: string) => void;
  // Fired on meaningful changes to "am I doing something the other side
  // should see live" -- draft text present/typed vs. empty, and actively
  // recording vs. not. null means "stopped" (cleared input, sent, paused,
  // discarded). The page owns turning this into an actual socket emit,
  // since it's the one that knows whether it's a channel or a DM.
  onTypingChange?: (status: 'typing' | 'recording' | null) => void;
}

const ACCEPT = 'image/*,video/*,audio/*';
const BAR_COUNT = 48;
const WAVE_SAMPLE_MS = 80;
const WAVE_MIN_LEVEL = 0.06;

type RecordState = 'idle' | 'recording' | 'paused';

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function mimeToExt(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

// Deterministic pseudo-waveform seeded from a URL -- same shape every
// render for a given recording, not a real amplitude analysis of the file.
// Pure per-bar noise reads as a flat gray blur, not a "wave" -- layering a
// slow undulation (so neighboring bars trend together, like a real
// waveform's envelope) under per-bar jitter, with a wide height range, is
// what actually produces visible peaks and valleys.
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

// Compact "about to send" chip for a picked image/video/file -- deliberately
// not the full player used inside an actual message bubble (that's
// MessageAttachment); this just confirms what's attached and lets it be removed.
function PendingChip({ pending, onRemove }: { pending: UploadResult; onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-2 border border-green-900/50 rounded-sm pl-1.5 pr-2 py-1.5 bg-green-950/10 max-w-[16rem]">
      {pending.type === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny local preview thumbnail
        <img src={pending.url} alt="" className="w-8 h-8 rounded-sm object-cover shrink-0" />
      ) : (
        <span className="w-8 h-8 rounded-sm bg-green-950/40 border border-green-900/40 flex items-center justify-center text-green-500 shrink-0 text-[9px] uppercase font-bold">
          {pending.type === 'video' ? 'vid' : 'file'}
        </span>
      )}
      <span className="text-xs text-green-400 truncate flex-1">{pending.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-green-900 hover:text-red-500 transition-colors shrink-0"
        title="remove attachment"
      >
        <XIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Paused/"ready to send" preview wave -- the clip is already fully
// recorded and known at this point, so it renders as a complete waveform
// spanning the row (equal-width slots holding a fixed thin bar each, so
// width never grows with the container the way flex-1 stretching would).
// Colored per theme (green in hacker, blue elsewhere) via --wave-color;
// bars before playedFraction (scrubbing through what's already been
// recorded) switch to a dim "played" gray.
function WaveBars({ levels, playedFraction }: { levels: number[]; playedFraction?: number }) {
  return (
    <div className="flex items-center h-6 flex-1 min-w-0">
      {levels.map((level, i) => {
        const played = playedFraction === undefined || i / levels.length < playedFraction;
        return (
          <div key={i} className="flex-1 min-w-0 flex justify-center">
            <span
              className="w-[2.5px] rounded-full transition-[height] duration-100 ease-out"
              style={{ height: `${4 + level * 18}px`, backgroundColor: played ? WAVE_COLOR : '#52525b' }}
            />
          </div>
        );
      })}
    </div>
  );
}

// Live wave while actively recording -- unlike the paused preview, this
// clip isn't fully known yet, so it shouldn't pretend to already span the
// whole row. It starts with nothing and grows one fixed-width bar at a
// time as audio comes in, anchored to the right edge (new bars enter on
// the right, the growing wave extends leftward, like a train pulling in)
// rather than always looking artificially "full" from the first frame.
function LiveWaveform({ levels }: { levels: number[] }) {
  return (
    <div className="flex-1 min-w-0 h-6 flex items-center justify-end overflow-hidden">
      <div className="flex items-center gap-[2px]">
        {levels.map((level, i) => (
          <span
            key={i}
            className="w-[3px] shrink-0 rounded-full transition-[height] duration-100 ease-out"
            style={{ height: `${4 + level * 18}px`, backgroundColor: '#9ca3af' }}
          />
        ))}
      </div>
    </div>
  );
}

// The paused/"ready to send" row -- play the recording back, see a static
// waveform with a progress dot, and a running clock. Inline, no box around
// it -- it's just this row's content, same as the live waveform is.
function RecordedPreview({ url, totalSeconds }: { url: string; totalSeconds: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const bars = useMemo(() => seededBars(url, BAR_COUNT), [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnd = () => { setPlaying(false); setCurrentTime(0); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const progress = totalSeconds > 0 ? currentTime / totalSeconds : 0;

  return (
    <>
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        title={playing ? 'pause' : 'play'}
        className="text-green-400 hover:text-green-300 transition-colors shrink-0"
      >
        {playing ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
      </button>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: WAVE_COLOR }} />
        <WaveBars levels={bars} playedFraction={progress} />
      </div>
      <span className="text-green-600 text-xs font-mono tabular-nums shrink-0">
        {formatDuration(playing || currentTime > 0 ? currentTime : totalSeconds)}
      </span>
    </>
  );
}

export default function ChatComposer({ placeholder, onSend, onOptimisticSend, onOptimisticFailed, onTypingChange }: ChatComposerProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [pending, setPending] = useState<UploadResult | null>(null);

  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [recordSeconds, setRecordSeconds] = useState(0);
  // Starts empty and grows as you speak -- doesn't need to (and shouldn't)
  // look artificially full-width from the very first sample.
  const [waveform, setWaveform] = useState<number[]>([]);
  // Local (not-yet-uploaded) preview of what's been recorded so far, while
  // paused -- an object URL, so it can be listened to before deciding to
  // resume, discard, or send.
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const waveRafRef = useRef<number | null>(null);
  const lastSampleRef = useRef(0);

  // Kept in a ref (always current) rather than a useEffect dependency, so
  // the unmount cleanup below can call the latest callback without needing
  // to re-run (and re-fire) every time the parent passes a new function
  // identity on re-render.
  const onTypingChangeRef = useRef(onTypingChange);
  onTypingChangeRef.current = onTypingChange;
  const typingResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTypingResetTimer = () => {
    if (typingResetRef.current) { clearTimeout(typingResetRef.current); typingResetRef.current = null; }
  };

  // Announce "stopped" on unmount (navigating away mid-draft/mid-recording)
  // so the other side doesn't see a stale "typing..." forever.
  useEffect(() => {
    return () => {
      clearTypingResetTimer();
      onTypingChangeRef.current?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadFile = async (file: File): Promise<UploadResult | null> => {
    setUploadError('');
    setUploading(true);
    try {
      return await uploadsApi.upload(file);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;
    const result = await uploadFile(file);
    if (result) setPending(result);
  };

  // --- Live waveform: rAF loop only, doesn't own the audio graph itself so
  // it can be paused/resumed without tearing down and rebuilding the analyser. ---
  const stopWaveformLoop = () => {
    if (waveRafRef.current !== null) { cancelAnimationFrame(waveRafRef.current); waveRafRef.current = null; }
  };

  const runWaveformLoop = () => {
    const tick = (time: number) => {
      if (!analyserRef.current || !waveDataRef.current) return;
      if (time - lastSampleRef.current >= WAVE_SAMPLE_MS) {
        lastSampleRef.current = time;
        analyserRef.current.getByteTimeDomainData(waveDataRef.current);
        let sumSquares = 0;
        for (let i = 0; i < waveDataRef.current.length; i++) {
          const normalized = (waveDataRef.current[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / waveDataRef.current.length);
        const rawLevel = Math.max(WAVE_MIN_LEVEL, Math.min(1, rms * 3)); // amplify -- typical speech RMS is small, kept modest for a calmer pulse
        setWaveform(prev => {
          // getByteTimeDomainData isn't affected by analyser.smoothingTimeConstant
          // (that only applies to frequency-domain reads) -- ease toward each new
          // reading manually instead of jumping straight to it, for a calmer wave.
          const lastLevel = prev.length > 0 ? prev[prev.length - 1] : WAVE_MIN_LEVEL;
          const smoothed = lastLevel * 0.4 + rawLevel * 0.6;
          // New bars enter on the right (appended) -- while there's still
          // room, just grow the wave (train pulling in); once it's reached
          // full length, slide the window so the oldest falls off the left.
          if (prev.length < BAR_COUNT) return [...prev, smoothed];
          return [...prev.slice(1), smoothed];
        });
      }
      waveRafRef.current = requestAnimationFrame(tick);
    };
    waveRafRef.current = requestAnimationFrame(tick);
  };

  const buildAnalyser = (stream: MediaStream) => {
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return; // no Web Audio support -- recording still works, just no live visual

    const audioCtx = new AudioCtor();
    audioContextRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    waveDataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    lastSampleRef.current = 0;
    runWaveformLoop();
  };

  const teardownAudioGraph = () => {
    stopWaveformLoop();
    analyserRef.current = null;
    waveDataRef.current = null;
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null; }
    setWaveform([]);
  };

  // Forces the recorder to flush whatever it's buffered into
  // recordedChunksRef right now, so a local preview can be built from
  // exactly what's been captured so far (used on pause).
  const flushRecorderData = (): Promise<void> => {
    return new Promise(resolve => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) { resolve(); return; }
      recorder.addEventListener('dataavailable', () => resolve(), { once: true });
      recorder.requestData();
    });
  };

  const waitForStop = (): Promise<void> => {
    return new Promise(resolve => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') { resolve(); return; }
      recorder.addEventListener('stop', () => resolve(), { once: true });
      recorder.stop();
    });
  };

  const resetRecording = () => {
    teardownAudioGraph();
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setLocalPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    recordedChunksRef.current = [];
    mediaRecorderRef.current = null;
    setRecordSeconds(0);
    setRecordState('idle');
    onTypingChange?.(null);
  };

  const startRecording = async () => {
    setUploadError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      recordedChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };

      recorder.start();
      buildAnalyser(stream);
      setRecordState('recording');
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
      clearTypingResetTimer();
      onTypingChange?.('recording');
    } catch {
      setUploadError('Could not access microphone');
    }
  };

  // Pauses without finalizing -- the clip can still be extended with
  // "resume", discarded, or sent as-is from here.
  const pauseRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    await flushRecorderData();
    recorder.pause();
    stopWaveformLoop();
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }

    const mimeType = recorder.mimeType || 'audio/webm';
    const blob = new Blob(recordedChunksRef.current, { type: mimeType });
    const url = URL.createObjectURL(blob);
    setLocalPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    setRecordState('paused');
    onTypingChange?.(null);
  };

  const resumeRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'paused') return;
    setLocalPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    recorder.resume();
    runWaveformLoop();
    recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    setRecordState('recording');
    clearTypingResetTimer();
    onTypingChange?.('recording');
  };

  const discardRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null; // discard, not finalize -- no upload/send should follow
      recorder.stop();
    }
    resetRecording();
  };

  // Stops (finalizing whatever's been recorded across every
  // record/pause/resume cycle) and sends it as the message. The upload to
  // Cloudinary is the slow part of this -- rather than leave the composer
  // sitting there for however long that takes, the message is shown right
  // away using the local (not-yet-uploaded) recording via onOptimisticSend,
  // and the composer resets immediately too. The real upload + save still
  // happens, just invisibly, and the placeholder gets swapped for the real
  // message once it lands (or removed if it ultimately fails).
  const finalizeAndSendRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    try {
      if (recorder.state !== 'inactive') await waitForStop();
      const mimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      if (blob.size === 0) { resetRecording(); return; }

      const durationSeconds = recordSeconds;
      const file = new File([blob], `voice-note-${Date.now()}.${mimeToExt(mimeType)}`, { type: mimeType });
      const tempId = `temp-${Date.now()}`;
      const localUrl = URL.createObjectURL(blob);

      onOptimisticSend?.(tempId, { url: localUrl, durationSeconds, name: file.name });
      resetRecording();

      // Deliberately not using the shared uploadFile() helper here -- that
      // toggles the same `uploading` state the file-picker path uses to
      // disable the composer, which would be wrong now: the composer has
      // already moved on (reset to idle above), so this upload is fully
      // backgrounded and shouldn't block anything currently on screen.
      try {
        const result = await uploadsApi.upload(file);
        await onSend(
          {
            attachmentUrl: result.url,
            attachmentType: result.type,
            attachmentName: result.name,
            attachmentDuration: durationSeconds,
          },
          tempId,
        );
      } catch {
        setUploadError('Voice message failed to send');
        onOptimisticFailed?.(tempId);
      }
    } catch { /* stop() itself failed -- nothing was ever shown, nothing to clean up */ }
  };

  // Re-armed on every keystroke -- if typing pauses for a few seconds
  // without sending or clearing the input, treat it as "stopped" so the
  // indicator on the other side doesn't hang forever.
  const handleDraftChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDraft(value);
    clearTypingResetTimer();
    if (value.trim()) {
      onTypingChange?.('typing');
      typingResetRef.current = setTimeout(() => onTypingChange?.(null), 3000);
    } else {
      onTypingChange?.(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Sending mid-recording doesn't require pausing first -- finalize
    // (which stops the recorder regardless of its current state), upload,
    // and send in one motion.
    if (recordState === 'recording' || recordState === 'paused') {
      await finalizeAndSendRecording();
      return;
    }

    const content = draft.trim();
    if (!content && !pending) return;
    clearTypingResetTimer();
    onTypingChange?.(null);
    setSending(true);
    try {
      await onSend({
        content: content || undefined,
        attachmentUrl: pending?.url,
        attachmentType: pending?.type,
        attachmentName: pending?.name,
      });
      setDraft('');
      setPending(null);
    } catch { /* leave the draft/attachment in place so nothing is lost */ }
    finally { setSending(false); }
  };

  const busy = sending || uploading;
  const canSend =
    recordState === 'recording' ||
    recordState === 'paused' ||
    (recordState === 'idle' && (draft.trim().length > 0 || !!pending));

  return (
    <div className="border-t border-green-900/40 bg-black shrink-0">
      {uploadError && (
        <div className="px-4 sm:px-6 pt-2 text-xs text-red-500">{uploadError}</div>
      )}

      {pending && (
        <div className="px-4 sm:px-6 pt-2.5">
          <PendingChip pending={pending} onRemove={() => setPending(null)} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-3 flex items-center gap-3">
        {recordState === 'paused' ? (
          <>
            <button
              type="button"
              onClick={discardRecording}
              title="discard recording"
              className="text-green-700 hover:text-red-500 transition-colors shrink-0"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
            {localPreviewUrl && <RecordedPreview url={localPreviewUrl} totalSeconds={recordSeconds} />}
            <button
              type="button"
              onClick={resumeRecording}
              title="resume recording"
              className="text-green-800 hover:text-green-500 transition-colors shrink-0"
            >
              <MicIcon className="w-5 h-5" />
            </button>
          </>
        ) : (
          <>
            <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleFilePicked} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || recordState !== 'idle'}
              title="attach a file"
              className="text-green-800 hover:text-green-500 disabled:opacity-40 transition-colors shrink-0"
            >
              <PaperclipIcon className="w-5 h-5" />
            </button>

            {recordState === 'recording' ? (
              <div className="flex-1 min-w-0 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                <span className="text-red-400 text-xs font-mono tabular-nums shrink-0">{formatDuration(recordSeconds)}</span>
                <LiveWaveform levels={waveform} />
              </div>
            ) : (
              <input
                type="text"
                value={draft}
                onChange={handleDraftChange}
                placeholder={uploading ? 'uploading...' : placeholder}
                disabled={uploading}
                className="flex-1 px-3 py-2 bg-black border border-green-900 rounded-sm text-green-300 placeholder-green-900 focus:outline-none focus:border-green-500 font-mono text-sm disabled:opacity-60"
              />
            )}

            <button
              type="button"
              onClick={recordState === 'recording' ? pauseRecording : startRecording}
              disabled={busy}
              title={recordState === 'recording' ? 'pause recording' : 'record a voice message'}
              className={`transition-colors shrink-0 disabled:opacity-40 ${
                recordState === 'recording' ? 'text-red-500 hover:text-red-400 animate-pulse' : 'text-green-800 hover:text-green-500'
              }`}
            >
              {recordState === 'recording' ? <StopIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
            </button>
          </>
        )}

        <button
          type="submit"
          disabled={busy || !canSend}
          title="send"
          className="text-black bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:hover:bg-green-500 transition-colors rounded-full p-2.5 shrink-0"
        >
          <SendIcon className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
