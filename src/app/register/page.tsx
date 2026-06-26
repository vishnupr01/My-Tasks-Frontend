'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import { auth } from '@/lib/api';
import { setToken } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (email: string, password: string, name?: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await auth.register(email, password, name);
      setToken(res.token);
      router.push('/tasks');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-black font-mono">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col bg-black border-r border-green-900/40 p-10">
        <div className="border border-green-900/50 rounded-sm overflow-hidden flex-1 flex flex-col shadow-[0_0_40px_rgba(34,197,94,0.05)]">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-green-900/50 bg-green-950/20">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-900/60 border border-red-800/40" />
              <span className="w-3 h-3 rounded-full bg-yellow-900/60 border border-yellow-800/40" />
              <span className="w-3 h-3 rounded-full bg-green-900/60 border border-green-800/40" />
            </div>
            <span className="text-green-800 text-xs ml-2">taskflow@terminal:~</span>
          </div>

          <div className="flex-1 p-6 text-sm space-y-2">
            <div className="flex gap-3"><span className="text-green-500 w-4">$</span><span className="text-green-300">taskflow --register</span></div>
            <div className="flex gap-3"><span className="text-green-700 w-4">&gt;</span><span className="text-green-700">initializing new user...</span></div>
            <div className="flex gap-3"><span className="text-green-700 w-4">&gt;</span><span className="text-green-700">allocating workspace...</span></div>
            <div className="flex gap-3"><span className="text-green-700 w-4">&gt;</span><span className="text-green-700">status: [ READY ]</span></div>
            <div className="pt-3 border-t border-green-950 mt-3">
              <p className="text-green-800 text-xs mb-3">// what you get:</p>
              {[
                'unlimited tasks',
                'kanban board view',
                'sub-task support',
                'daily streak tracker',
                'priority filtering',
                'full-text search',
              ].map(f => (
                <div key={f} className="flex gap-3 mb-1.5">
                  <span className="text-green-600 w-4 shrink-0">+</span>
                  <span className="text-green-600">{f}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <span className="text-green-500">$</span>
              <span className="text-green-400 cursor">create_account</span>
            </div>
          </div>
        </div>
        <p className="text-green-900 text-xs mt-4 text-center">// free forever · no credit card needed</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-black">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <span className="text-green-500 font-bold text-xl">&gt;_</span>
            <span className="font-bold text-green-400 text-lg">taskflow</span>
          </div>

          <div className="mb-8">
            <p className="text-green-700 text-xs mb-1">// new_user --init</p>
            <h1 className="text-2xl font-bold text-green-400">create_account<span className="cursor" /></h1>
            <p className="text-green-800 text-sm mt-1">set up your workspace in seconds</p>
          </div>

          <AuthForm mode="register" onSubmit={handleRegister} error={error} loading={loading} />

          <p className="mt-6 text-center text-xs text-green-900">
            already registered?{' '}
            <Link href="/login" className="text-green-600 hover:text-green-400 transition-colors">
              sign_in --existing
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
