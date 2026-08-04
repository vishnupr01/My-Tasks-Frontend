'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/api';

const USERNAME_RE = /^[a-z0-9._]{3,20}$/;

interface AuthFormProps {
  mode: 'login' | 'register';
  onSubmit: (email: string, password: string, name?: string, username?: string, inviteCode?: string) => Promise<void>;
  error?: string;
  loading?: boolean;
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

export default function AuthForm({ mode, onSubmit, error, loading }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');

  const usernameDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (mode !== 'register') return;

    if (usernameDebounce.current) clearTimeout(usernameDebounce.current);

    if (!USERNAME_RE.test(username)) {
      setUsernameStatus('idle');
      return;
    }

    setUsernameStatus('checking');
    usernameDebounce.current = setTimeout(async () => {
      try {
        const res = await auth.checkUsername(username);
        setUsernameStatus(res.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);

    return () => { if (usernameDebounce.current) clearTimeout(usernameDebounce.current); };
  }, [username, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(
      email,
      password,
      mode === 'register' ? name : undefined,
      mode === 'register' ? username : undefined,
      mode === 'register' ? inviteCode : undefined,
    );
  };

  const inputCls = "w-full px-3 py-2.5 bg-black border border-green-900 rounded text-green-300 placeholder-green-900 focus:outline-none focus:border-green-500 focus:shadow-[0_0_8px_rgba(var(--glow-rgb),calc(0.2*var(--glow-mult)))] transition-all font-mono text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === 'register' && (
        <div className="space-y-1">
          <label className="block text-xs text-green-700 uppercase tracking-widest">// username</label>
          <input
            type="text"
            required
            pattern="[a-z0-9._]{3,20}"
            title="3-20 characters: lowercase letters, numbers, . or _"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase())}
            className={inputCls}
            placeholder="your_handle"
          />
          {usernameStatus === 'checking' && <p className="text-xs text-green-800">checking availability...</p>}
          {usernameStatus === 'available' && <p className="text-xs text-green-500">✓ available</p>}
          {usernameStatus === 'taken' && <p className="text-xs text-red-400">✗ username already taken</p>}
        </div>
      )}

      {mode === 'register' && (
        <div className="space-y-1">
          <label className="block text-xs text-green-700 uppercase tracking-widest">// name <span className="text-green-900 normal-case">(optional)</span></label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="your_name" />
        </div>
      )}

      {mode === 'register' && (
        <div className="space-y-1">
          <label className="block text-xs text-green-700 uppercase tracking-widest">// invite code <span className="text-green-900 normal-case">(if you have one)</span></label>
          <input
            type="text"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value.trim())}
            className={inputCls}
            placeholder="leave blank if you were approved by email"
          />
          <p className="text-xs text-green-900">
            no code?{' '}
            <Link href="/request-access" className="text-green-600 hover:text-green-400 transition-colors">
              request access
            </Link>{' '}
            first.
          </p>
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-xs text-green-700 uppercase tracking-widest">// email</label>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="user@domain.com" />
      </div>

      <div className="space-y-1">
        <label className="block text-xs text-green-700 uppercase tracking-widest">// password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required minLength={6}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={`${inputCls} pr-10`}
            placeholder="••••••••"
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-green-800 hover:text-green-500 transition-colors">
            {showPassword
              ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            }
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2.5 bg-red-950/30 border border-red-800/50 rounded text-sm text-red-400 font-mono">
          <span className="text-red-600 shrink-0">[ERR]</span> {error}
        </div>
      )}

      <button type="submit" disabled={loading || (mode === 'register' && usernameStatus === 'taken')}
        className="w-full py-2.5 px-4 bg-green-500 text-black font-bold text-sm rounded hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_16px_rgba(var(--glow-rgb),calc(0.25*var(--glow-mult)))] hover:shadow-[0_0_24px_rgba(var(--glow-rgb),calc(0.4*var(--glow-mult)))] active:scale-[0.98] uppercase tracking-widest">
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            authenticating...
          </span>
        ) : mode === 'login' ? '> access_granted' : '> create_user'}
      </button>
    </form>
  );
}
