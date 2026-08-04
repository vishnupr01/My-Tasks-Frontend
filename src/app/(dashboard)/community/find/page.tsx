'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { users as usersApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

interface UserResult {
  id: string;
  name: string | null;
  username: string;
}

export default function FindUsersPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);

    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await usersApi.search(query.trim());
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 400);

    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  return (
    <div className="min-h-screen bg-black font-mono">
      <header className="border-b border-green-900/40 bg-black">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
          <span className="text-green-400 font-bold tracking-widest text-sm">FIND_USERS</span>
          <span className="text-green-900 text-xs hidden sm:inline ml-2">// search by name or username</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="search_users..."
          className="w-full px-3 py-2.5 bg-black border border-green-900 rounded-sm text-green-300 placeholder-green-900 focus:outline-none focus:border-green-500 focus:shadow-[0_0_8px_rgba(var(--glow-rgb),calc(0.2*var(--glow-mult)))] transition-all font-mono text-sm"
        />

        {loading && (
          <div className="flex items-center gap-2 text-xs text-green-800 py-4">
            <div className="w-3 h-3 border-2 border-green-900 border-t-green-500 rounded-full animate-spin" />
            searching...
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <p className="text-xs text-green-950 py-4">// no users found</p>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-2">
            {results.map(u => (
              <div key={u.id} className="flex items-center justify-between border border-green-900/40 rounded-sm px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-sm bg-green-950/30 border border-green-900/50 flex items-center justify-center text-green-500 text-xs font-bold">
                    {(u.name || u.username)[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-green-300 text-sm">{u.name || u.username}</p>
                    <p className="text-green-800 text-xs">@{u.username}</p>
                  </div>
                </div>
                <button
                  disabled
                  title="friend requests coming soon"
                  className="text-xs text-green-950 border border-green-950 px-3 py-1.5 rounded-sm cursor-not-allowed"
                >
                  + add
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && !searched && !query && (
          <p className="text-xs text-green-950 py-4">// type a name or username to search</p>
        )}
      </main>
    </div>
  );
}
