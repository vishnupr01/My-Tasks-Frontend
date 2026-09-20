'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { useSettings } from '@/lib/settings-context';
import { playNotificationSound } from '@/lib/sound';

// iOS-style switch: 51x31 track, 27px white knob with a 2px inset, knob
// eases along a cubic-bezier and squeezes wider mid-drag/press like the
// real thing, track crossfades color rather than snapping.
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`group relative w-[51px] h-[31px] rounded-full shrink-0 transition-colors duration-200 ease-in-out ${
        disabled
          ? 'bg-green-950/30 cursor-not-allowed'
          : checked
            ? 'bg-green-500 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]'
            : 'bg-green-950/40 border border-green-900/60 hover:border-green-700'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-[27px] rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.4),0_0_0_0.5px_rgba(0,0,0,0.1)] transition-all duration-200 ease-in-out ${
          checked ? 'translate-x-5 w-[27px]' : 'translate-x-0 w-[27px]'
        } ${disabled ? '' : 'group-active:w-[31px]'} ${checked && !disabled ? 'group-active:translate-x-4' : ''}`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { loaded, notificationsEnabled, notificationSoundEnabled, setNotificationsEnabled, setNotificationSoundEnabled } = useSettings();

  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);

  return (
    <div className="min-h-screen bg-black font-mono">
      <header className="border-b border-green-900/40 bg-black">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
          <span className="text-green-400 font-bold tracking-widest text-sm">SETTINGS</span>
          <span className="text-green-900 text-xs hidden sm:inline ml-2">// only affects your account</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section className="space-y-3">
          <h2 className="text-green-500 text-xs uppercase tracking-widest">chat notifications</h2>

          <div className={`space-y-3 border border-green-900/40 rounded-sm px-4 py-3.5 transition-opacity ${loaded ? '' : 'opacity-50 pointer-events-none'}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-green-300 text-sm">notifications</p>
                <p className="text-green-900 text-xs mt-0.5">show a popup for new channel and DM messages when you&apos;re not already looking at that chat</p>
              </div>
              <Toggle checked={notificationsEnabled} onChange={setNotificationsEnabled} />
            </div>

            <div className="border-t border-green-900/30 pt-3 flex items-center justify-between gap-4">
              <div>
                <p className={`text-sm ${notificationsEnabled ? 'text-green-300' : 'text-green-900'}`}>notification sound</p>
                <p className="text-green-900 text-xs mt-0.5">play a short sound for new messages, even while you&apos;re chatting in that room</p>
              </div>
              <Toggle
                checked={notificationSoundEnabled}
                onChange={value => { setNotificationSoundEnabled(value); if (value) playNotificationSound(); }}
                disabled={!notificationsEnabled}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => playNotificationSound()}
            className="text-xs text-green-800 hover:text-green-500 transition-colors uppercase tracking-wide"
          >
            &gt; test sound
          </button>
        </section>
      </main>
    </div>
  );
}
