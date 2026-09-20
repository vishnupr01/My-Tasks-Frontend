'use client';

import Link from 'next/link';
import { useToast } from '@/lib/toast-context';
import { BellIcon } from '@/components/Icons';

export default function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-2.5 bg-black border border-green-700/60 rounded-sm px-3 py-2.5 shadow-[0_0_24px_rgba(var(--glow-rgb),calc(0.18*var(--glow-mult)))] font-mono animate-enter"
        >
          <span className="text-green-500 shrink-0 mt-0.5">
            <BellIcon className="w-4 h-4" />
          </span>
          <Link
            href={t.href}
            onClick={() => dismissToast(t.id)}
            className="flex-1 min-w-0"
          >
            <p className="text-green-400 text-xs font-bold truncate">{t.title}</p>
            <p className="text-green-700 text-xs truncate">{t.body}</p>
          </Link>
          <button
            onClick={() => dismissToast(t.id)}
            className="text-green-900 hover:text-green-500 text-xs shrink-0 leading-none"
            title="dismiss"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
