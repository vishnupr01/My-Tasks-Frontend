'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { roadmaps as roadmapsApi } from '@/lib/api';
import { isAuthenticated, getUser } from '@/lib/auth';
import type { RoadmapSummary } from '@/types';

export default function RoadmapsPage() {
  const router = useRouter();
  const [list, setList] = useState<RoadmapSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);
  useEffect(() => { setIsAdmin(!!getUser()?.isAdmin); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await roadmapsApi.list()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const rm = await roadmapsApi.create(name.trim(), description.trim() || undefined);
      setList(prev => [...prev, { ...rm, _count: { categories: 0 } }]);
      setShowCreate(false);
      setName('');
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Failed to create roadmap');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-black font-mono">
      <header className="border-b border-green-900/40 bg-black">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div>
            <span className="text-green-400 font-bold tracking-widest text-sm">ROADMAPS</span>
            <span className="text-green-900 text-xs hidden sm:inline ml-2">// interview prep by stack</span>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="text-xs font-bold px-4 py-1.5 bg-green-500 text-black rounded-sm hover:bg-green-400 transition-colors uppercase tracking-widest"
            >
              + create
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-2">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-green-800 py-4">
            <div className="w-3 h-3 border-2 border-green-900 border-t-green-500 rounded-full animate-spin" />
            loading...
          </div>
        )}

        {!loading && list.length === 0 && (
          <p className="text-xs text-green-950 py-4">// no roadmaps yet{isAdmin ? ' -- create one to get started' : ''}</p>
        )}

        {!loading && list.map(rm => (
          <Link
            key={rm.id}
            href={`/roadmaps/${rm.id}`}
            className="flex items-center justify-between border border-green-900/40 rounded-sm px-3 py-2.5 hover:border-green-700/60 hover:bg-green-950/10 transition-colors"
          >
            <div>
              <p className="text-green-300 text-sm">{rm.name}</p>
              {rm.description && <p className="text-green-900 text-xs">{rm.description}</p>}
            </div>
            <span className="text-[10px] text-green-800 uppercase tracking-widest">{rm._count.categories} categories</span>
          </Link>
        ))}
      </main>

      {showCreate && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="bg-black border border-green-900/60 rounded-sm w-full max-w-md">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-green-900/40 bg-green-950/10">
              <span className="text-green-600 text-xs font-bold tracking-widest">create_roadmap</span>
              <button onClick={() => setShowCreate(false)} className="text-green-900 hover:text-green-500 text-xs">[esc]</button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="block text-xs text-green-700 uppercase tracking-widest">// name</label>
                <input
                  type="text" required value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-green-900 rounded-sm text-green-300 placeholder-green-900 focus:outline-none focus:border-green-500 font-mono text-sm"
                  placeholder="MERN Stack"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-green-700 uppercase tracking-widest">// description <span className="text-green-900 normal-case">(optional)</span></label>
                <input
                  type="text" value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-green-900 rounded-sm text-green-300 placeholder-green-900 focus:outline-none focus:border-green-500 font-mono text-sm"
                  placeholder="what's this roadmap for"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-2.5 bg-red-950/30 border border-red-800/50 rounded-sm text-sm text-red-400">
                  <span className="text-red-600 shrink-0">[ERR]</span> {error}
                </div>
              )}

              <button
                type="submit" disabled={creating}
                className="w-full py-2.5 px-4 bg-green-500 text-black font-bold text-sm rounded-sm hover:bg-green-400 disabled:opacity-40 transition-all uppercase tracking-widest"
              >
                {creating ? 'creating...' : '> create'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
