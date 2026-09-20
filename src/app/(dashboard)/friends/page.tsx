'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { friends as friendsApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import ConfirmModal from '@/components/ConfirmModal';
import type { FriendRequestData, FriendUser } from '@/types';

type Tab = 'friends' | 'incoming' | 'outgoing';

export default function FriendsPage() {
  const router = useRouter();
  const [incoming, setIncoming] = useState<FriendRequestData[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestData[]>([]);
  const [friendList, setFriendList] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('friends');
  const [confirmRemove, setConfirmRemove] = useState<FriendUser | null>(null);

  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, out, list] = await Promise.all([
        friendsApi.listIncoming(),
        friendsApi.listOutgoing(),
        friendsApi.list(),
      ]);
      setIncoming(inc);
      setOutgoing(out);
      setFriendList(list);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const respond = async (id: string, status: 'ACCEPTED' | 'DECLINED') => {
    await friendsApi.respond(id, status);
    setIncoming(prev => prev.filter(r => r.id !== id));
    if (status === 'ACCEPTED') load(); // refresh friends list too
  };

  const cancel = async (id: string) => {
    await friendsApi.cancel(id);
    setOutgoing(prev => prev.filter(r => r.id !== id));
  };

  const executeRemoveFriend = async () => {
    if (!confirmRemove) return;
    await friendsApi.remove(confirmRemove.id);
    setFriendList(prev => prev.filter(f => f.id !== confirmRemove.id));
    setConfirmRemove(null);
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'friends', label: 'friends', count: friendList.length },
    { key: 'incoming', label: 'incoming', count: incoming.length },
    { key: 'outgoing', label: 'outgoing', count: outgoing.length },
  ];

  return (
    <div className="min-h-screen bg-black font-mono">
      <header className="border-b border-green-900/40 bg-black">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
          <span className="text-green-400 font-bold tracking-widest text-sm">FRIENDS</span>
          <span className="text-green-900 text-xs hidden sm:inline ml-2">// requests and connections</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-green-900/40">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-widest transition-colors ${
                tab === t.key ? 'text-green-400' : 'text-green-800 hover:text-green-600'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold ${
                  tab === t.key ? 'bg-green-500 text-black' : 'bg-green-950 text-green-600'
                }`}>
                  {t.count}
                </span>
              )}
              {tab === t.key && (
                <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-green-500 shadow-[0_0_8px_rgba(var(--glow-rgb),calc(0.4*var(--glow-mult)))]" />
              )}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-green-800 py-4">
            <div className="w-3 h-3 border-2 border-green-900 border-t-green-500 rounded-full animate-spin" />
            loading...
          </div>
        )}

        {!loading && (
          <div key={tab} className="animate-enter">
            {tab === 'friends' && (
              <div className="space-y-2">
                {friendList.length === 0 && (
                  <p className="text-xs text-green-950 py-4">
                    // no friends yet -- <Link href="/community/find" className="text-green-700 hover:text-green-500 underline">find users</Link> to add
                  </p>
                )}
                {friendList.map((f, i) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between border border-green-900/40 rounded-sm px-3 py-2.5 hover-lift hover:border-green-700/60 animate-enter"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <span className="text-green-300 text-sm truncate min-w-0">@{f.username}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <Link href={`/friends/${f.id}`} className="text-xs text-green-600 hover:text-green-400 transition-colors uppercase tracking-wide">message</Link>
                      <button onClick={() => setConfirmRemove(f)} className="text-xs text-red-600 hover:text-red-400 transition-colors uppercase tracking-wide">remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'incoming' && (
              <div className="space-y-2">
                {incoming.length === 0 && <p className="text-xs text-green-950 py-4">// nothing pending</p>}
                {incoming.map((r, i) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between border border-green-900/40 rounded-sm px-3 py-2.5 hover-lift hover:border-green-700/60 animate-enter"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <span className="text-green-300 text-sm">@{r.sender?.username}</span>
                    <div className="flex gap-2">
                      <button onClick={() => respond(r.id, 'ACCEPTED')} className="text-xs px-3 py-1.5 bg-green-500 text-black font-bold rounded-sm hover:bg-green-400 shadow-[0_0_10px_rgba(var(--glow-rgb),calc(0.2*var(--glow-mult)))] transition-all uppercase tracking-wide">accept</button>
                      <button onClick={() => respond(r.id, 'DECLINED')} className="text-xs px-3 py-1.5 border border-red-900/50 text-red-400 rounded-sm hover:bg-red-950/30 transition-colors uppercase tracking-wide">decline</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'outgoing' && (
              <div className="space-y-2">
                {outgoing.length === 0 && <p className="text-xs text-green-950 py-4">// none sent</p>}
                {outgoing.map((r, i) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between border border-green-900/40 rounded-sm px-3 py-2.5 hover-lift hover:border-green-700/60 animate-enter"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <span className="text-green-300 text-sm">@{r.receiver?.username}</span>
                    <button onClick={() => cancel(r.id)} className="text-xs text-green-800 hover:text-green-500 transition-colors uppercase tracking-wide">cancel</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {confirmRemove && (
        <ConfirmModal
          message={`remove @${confirmRemove.username} from your friends?`}
          subtext="you'll need to send a new friend request to reconnect."
          confirmLabel="remove"
          onConfirm={executeRemoveFriend}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
