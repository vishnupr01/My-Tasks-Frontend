'use client';

import { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  message: string;
  subtext?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ message, subtext, confirmLabel = 'confirm', onConfirm, onCancel }: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // focus cancel by default (safer)
  useEffect(() => { cancelRef.current?.focus(); }, []);

  // close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-black border border-green-900/60 rounded-sm shadow-[0_0_40px_rgba(34,197,94,0.06)] w-full max-w-sm font-mono">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-green-900/40 bg-green-950/10">
          <span className="text-yellow-500 text-xs">⚠</span>
          <span className="text-yellow-600 text-xs font-bold tracking-widest uppercase">warning</span>
          <span className="ml-auto text-green-900 text-xs">[process.confirm]</span>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-3">
          <div className="flex gap-2 items-start">
            <span className="text-red-600 text-xs shrink-0 mt-0.5">[!]</span>
            <p className="text-green-300 text-sm">{message}</p>
          </div>
          {subtext && (
            <p className="text-green-800 text-xs pl-5">{subtext}</p>
          )}
          <div className="border border-red-900/30 bg-red-950/20 rounded-sm px-3 py-2 text-xs text-red-600">
            // this action cannot be undone
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 py-2 text-xs font-bold text-green-700 border border-green-900/50 rounded-sm hover:border-green-700 hover:text-green-400 transition-all uppercase tracking-widest"
          >
            [esc] cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 text-xs font-bold bg-red-700 text-white border border-red-600 rounded-sm hover:bg-red-600 hover:shadow-[0_0_12px_rgba(239,68,68,0.3)] transition-all uppercase tracking-widest"
          >
            &gt; {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
