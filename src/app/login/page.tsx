'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import { auth } from '@/lib/api';
import { setToken, setUser } from '@/lib/auth';

const terminalLines = [
  { prompt: '$', cmd: 'taskflow --init', delay: 0 },
  { prompt: '>', cmd: 'loading modules...', delay: 0 },
  { prompt: '>', cmd: 'auth: [ OK ]', delay: 0 },
  { prompt: '>', cmd: 'database: [ CONNECTED ]', delay: 0 },
  { prompt: '>', cmd: 'status: [ ONLINE ]', delay: 0 },
  { prompt: '$', cmd: 'taskflow --features', delay: 0 },
  { prompt: '✓', cmd: 'kanban board', delay: 0 },
  { prompt: '✓', cmd: 'sub-tasks', delay: 0 },
  { prompt: '✓', cmd: 'streak tracker', delay: 0 },
  { prompt: '✓', cmd: 'priority filters', delay: 0 },
];

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (email: string, password: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await auth.login(email, password);
      setToken(res.token);
      setUser(res.user);
      router.push('/tasks');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-black font-mono">
      {/* Left terminal panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col bg-black border-r border-green-900/40 p-10">
        {/* Terminal window chrome */}
        <div className="border border-green-900/50 rounded-sm overflow-hidden flex-1 flex flex-col shadow-[0_0_40px_rgba(var(--glow-rgb),calc(0.05*var(--glow-mult)))]">
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-green-900/50 bg-green-950/20">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-900/60 border border-red-800/40" />
              <span className="w-3 h-3 rounded-full bg-yellow-900/60 border border-yellow-800/40" />
              <span className="w-3 h-3 rounded-full bg-green-900/60 border border-green-800/40" />
            </div>
            <span className="text-green-800 text-xs ml-2">taskflow@terminal:~</span>
          </div>

          {/* Terminal body */}
          <div className="flex-1 p-6 space-y-2 text-sm">
            {terminalLines.map((line, i) => (
              <div key={i} className="flex gap-3">
                <span className={`shrink-0 w-4 ${line.prompt === '$' ? 'text-green-500' : line.prompt === '✓' ? 'text-green-400' : 'text-green-700'}`}>
                  {line.prompt}
                </span>
                <span className={line.prompt === '>' ? 'text-green-700' : line.prompt === '✓' ? 'text-green-500' : 'text-green-300'}>
                  {line.cmd}
                </span>
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <span className="text-green-500">$</span>
              <span className="text-green-400 cursor">sign_in</span>
            </div>
          </div>
        </div>

        <p className="text-green-900 text-xs mt-4 text-center">// built for personal productivity</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-black">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <span className="text-green-500 font-bold text-xl">&gt;_</span>
            <span className="font-bold text-green-400 text-lg">taskflow</span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <p className="text-green-700 text-xs mb-1">// authentication required</p>
            <h1 className="text-2xl font-bold text-green-400">welcome_back<span className="cursor" /></h1>
            <p className="text-green-800 text-sm mt-1">enter credentials to continue</p>
          </div>

          <AuthForm mode="login" onSubmit={handleLogin} error={error} loading={loading} />

          <p className="mt-6 text-center text-xs text-green-900">
            no account?{' '}
            <Link href="/register" className="text-green-600 hover:text-green-400 transition-colors">
              register --new-user
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
