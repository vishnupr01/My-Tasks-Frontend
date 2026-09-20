'use client';

import { useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/api';

export default function RequestAccessPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await auth.requestAccess(email);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black font-mono px-6">
      <div className="w-full max-w-md">
        <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
          <span className="text-green-500 font-bold text-xl">&gt;_</span>
          <span className="font-bold text-green-400 text-lg">taskflow</span>
        </div>

        <div className="mb-8 text-center">
          <p className="text-green-700 text-xs mb-1">// closed access</p>
          <h1 className="text-2xl font-bold text-green-400">request_access</h1>
          <p className="text-green-800 text-sm mt-1">this platform is invite-only. submit your email for review.</p>
        </div>

        {submitted ? (
          <div className="border border-green-900/50 rounded-sm bg-green-950/10 p-5 text-center space-y-2">
            <p className="text-green-400 text-sm">✓ request submitted</p>
            <p className="text-green-800 text-xs">
              you&apos;ll be able to register once approved. no email will be sent — check back or wait to be contacted.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs text-green-700 uppercase tracking-widest">// email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-black border border-green-900 rounded text-green-300 placeholder-green-900 focus:outline-none focus:border-green-500 focus:shadow-[0_0_8px_rgba(var(--glow-rgb),calc(0.2*var(--glow-mult)))] transition-all font-mono text-sm"
                placeholder="user@domain.com"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="email"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-2.5 bg-red-950/30 border border-red-800/50 rounded text-sm text-red-400 font-mono">
                <span className="text-red-600 shrink-0">[ERR]</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-green-500 text-black font-bold text-sm rounded hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_16px_rgba(var(--glow-rgb),calc(0.25*var(--glow-mult)))] uppercase tracking-widest"
            >
              {loading ? 'submitting...' : '> request_access'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-green-900">
          have a code?{' '}
          <Link href="/register" className="text-green-600 hover:text-green-400 transition-colors">
            register --with-code
          </Link>
        </p>
      </div>
    </div>
  );
}
