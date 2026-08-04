'use client';

import { useState, useEffect, useRef } from 'react';
import { users as usersApi } from '@/lib/api';

interface UserResult {
  id: string;
  name: string | null;
  username: string;
}

interface UserPickerProps {
  onSelect: (user: UserResult) => void;
  placeholder?: string;
}

export default function UserPicker({ onSelect, placeholder }: UserPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) { setResults([]); return; }

    debounce.current = setTimeout(async () => {
      setLoading(true);
      try { setResults(await usersApi.search(query.trim())); }
      catch { setResults([]); }
      finally { setLoading(false); }
    }, 400);

    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  const pick = (user: UserResult) => {
    onSelect(user);
    setQuery('');
    setResults([]);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder ?? 'search users...'}
        className="w-full px-3 py-2 bg-black border border-green-900 rounded-sm text-green-300 placeholder-green-900 focus:outline-none focus:border-green-500 transition-all font-mono text-sm"
      />
      {loading && <p className="text-[10px] text-green-800 mt-1">searching...</p>}
      {!loading && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full border border-green-900/60 bg-black rounded-sm max-h-48 overflow-y-auto scrollbar-thin">
          {results.map(u => (
            <button
              key={u.id}
              onClick={() => pick(u)}
              className="w-full text-left px-3 py-2 text-xs text-green-400 hover:bg-green-950/30 transition-colors"
            >
              {u.name || u.username} <span className="text-green-800">@{u.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
