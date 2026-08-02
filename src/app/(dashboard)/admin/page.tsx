'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { admin } from '@/lib/api';
import { isAuthenticated, getUser } from '@/lib/auth';
import type { AccessRequest, InviteCode, Member } from '@/types';

export default function AdminPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selfId = getUser()?.id;

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    if (!getUser()?.isAdmin) { router.replace('/tasks'); return; }
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, c, m] = await Promise.all([admin.listAccessRequests(), admin.listInviteCodes(), admin.listUsers()]);
      setRequests(r);
      setCodes(c);
      setMembers(m);
    } catch { /* guard redirect already handles unauthorized */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, status: 'APPROVED' | 'DECLINED') => {
    const updated = await admin.decideAccessRequest(id, status);
    setRequests(prev => prev.map(r => (r.id === id ? updated : r)));
  };

  const generateCode = async () => {
    setGenerating(true);
    try {
      const code = await admin.createInviteCode();
      setCodes(prev => [code, ...prev]);
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const toggleActive = async (id: string, current: boolean) => {
    const updated = await admin.setUserActive(id, !current);
    setMembers(prev => prev.map(m => (m.id === id ? { ...m, isActive: updated.isActive } : m)));
  };

  const pending = requests.filter(r => r.status === 'PENDING');
  const decided = requests.filter(r => r.status !== 'PENDING');

  if (loading) {
    return (
      <div className="min-h-screen bg-black font-mono flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-green-900 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black font-mono">
      <header className="border-b border-green-900/40 bg-black">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <span className="text-green-400 font-bold tracking-widest text-sm">ADMIN</span>
          <span className="text-green-900 text-xs hidden sm:inline ml-2">// access control</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Access requests */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-green-500 text-xs uppercase tracking-widest">access_requests</h2>
            <span className="text-xs text-green-900">{pending.length} pending</span>
          </div>

          {pending.length === 0 && (
            <p className="text-xs text-green-950">// no pending requests</p>
          )}

          <div className="space-y-2">
            {pending.map(r => (
              <div key={r.id} className="flex items-center justify-between border border-green-900/40 rounded-sm px-3 py-2.5">
                <div>
                  <p className="text-green-300 text-sm">{r.email}</p>
                  <p className="text-green-900 text-xs">{new Date(r.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => decide(r.id, 'APPROVED')}
                    className="text-xs px-3 py-1.5 bg-green-500 text-black font-bold rounded-sm hover:bg-green-400 transition-colors uppercase tracking-wide"
                  >
                    approve
                  </button>
                  <button
                    onClick={() => decide(r.id, 'DECLINED')}
                    className="text-xs px-3 py-1.5 border border-red-900/50 text-red-400 rounded-sm hover:bg-red-950/30 transition-colors uppercase tracking-wide"
                  >
                    decline
                  </button>
                </div>
              </div>
            ))}
          </div>

          {decided.length > 0 && (
            <details className="text-xs">
              <summary className="text-green-900 cursor-pointer">// {decided.length} decided</summary>
              <div className="mt-2 space-y-1.5">
                {decided.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                    <span className="text-green-800">{r.email}</span>
                    <span className={r.status === 'APPROVED' ? 'text-green-600' : 'text-red-500'}>{r.status.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* Invite codes */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-green-500 text-xs uppercase tracking-widest">invite_codes</h2>
            <button
              onClick={generateCode}
              disabled={generating}
              className="text-xs px-3 py-1.5 bg-green-500 text-black font-bold rounded-sm hover:bg-green-400 disabled:opacity-40 transition-colors uppercase tracking-wide"
            >
              {generating ? 'generating...' : '+ generate'}
            </button>
          </div>

          {codes.length === 0 && (
            <p className="text-xs text-green-950">// no codes generated yet</p>
          )}

          <div className="space-y-2">
            {codes.map(c => (
              <div key={c.id} className="flex items-center justify-between border border-green-900/40 rounded-sm px-3 py-2.5">
                <div>
                  <button
                    onClick={() => copyCode(c.code, c.id)}
                    className="text-green-300 text-sm font-bold tracking-wider hover:text-green-400 transition-colors"
                    title="click to copy"
                  >
                    {c.code} {copiedId === c.id && <span className="text-green-600 text-xs">copied</span>}
                  </button>
                  <p className="text-green-900 text-xs">{new Date(c.createdAt).toLocaleString()}</p>
                </div>
                <span className={`text-xs ${c.usedBy ? 'text-green-900' : 'text-green-600'}`}>
                  {c.usedBy ? `used by @${c.usedBy.username}` : 'unused'}
                </span>
              </div>
            ))}
          </div>
        </section>
        {/* Members */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-green-500 text-xs uppercase tracking-widest">members</h2>
            <span className="text-xs text-green-900">{members.length} total</span>
          </div>

          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between border border-green-900/40 rounded-sm px-3 py-2.5">
                <div>
                  <p className="text-green-300 text-sm">
                    @{m.username} {m.isAdmin && <span className="text-yellow-500 text-xs">[admin]</span>}
                  </p>
                  <p className="text-green-900 text-xs">{m.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs ${m.isActive ? 'text-green-600' : 'text-red-500'}`}>
                    {m.isActive ? 'active' : 'removed'}
                  </span>
                  {m.id !== selfId && (
                    <button
                      onClick={() => toggleActive(m.id, m.isActive)}
                      className={`text-xs px-3 py-1.5 rounded-sm uppercase tracking-wide transition-colors ${
                        m.isActive
                          ? 'border border-red-900/50 text-red-400 hover:bg-red-950/30'
                          : 'bg-green-500 text-black font-bold hover:bg-green-400'
                      }`}
                    >
                      {m.isActive ? 'remove' : 'restore'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
