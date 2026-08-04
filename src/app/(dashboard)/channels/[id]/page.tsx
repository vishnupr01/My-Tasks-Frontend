'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { channels as channelsApi, roles as rolesApi } from '@/lib/api';
import { isAuthenticated, getUser } from '@/lib/auth';
import UserPicker from '@/components/UserPicker';
import { LockIcon, HashIcon } from '@/components/Icons';
import type { Channel, ChatMessage, ChannelAccessGrant, Role } from '@/types';

const POLL_MS = 4000;

export default function ChannelPage() {
  const router = useRouter();
  const params = useParams();
  const channelId = params.id as string;

  const [channel, setChannel] = useState<Channel | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showManage, setShowManage] = useState(false);

  const [access, setAccess] = useState<ChannelAccessGrant[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [roleToGrant, setRoleToGrant] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);
  useEffect(() => { setIsAdmin(!!getUser()?.isAdmin); }, []);

  const loadChannel = useCallback(async () => {
    try {
      const list = await channelsApi.list();
      const found = list.find(c => c.id === channelId);
      if (!found) { setNotFound(true); return; }
      setChannel(found);
    } catch { setNotFound(true); }
  }, [channelId]);

  const loadMessages = useCallback(async () => {
    try { setMessages(await channelsApi.listMessages(channelId)); }
    catch { /* access revoked mid-session, etc -- just stop showing new ones */ }
  }, [channelId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadChannel(), loadMessages()]).finally(() => setLoading(false));

    pollRef.current = setInterval(loadMessages, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadChannel, loadMessages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadManageData = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([channelsApi.listAccess(channelId), rolesApi.list()]);
      setAccess(a);
      setAllRoles(r);
    } catch { /* not admin, or no access */ }
  }, [channelId]);

  useEffect(() => { if (showManage) loadManageData(); }, [showManage, loadManageData]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      const msg = await channelsApi.sendMessage(channelId, draft.trim());
      setMessages(prev => [...prev, msg]);
      setDraft('');
    } catch { /* show nothing fancy for now -- just don't clear the draft */ }
    finally { setSending(false); }
  };

  const grantUser = async (user: { id: string }) => {
    const grant = await channelsApi.grantAccessToUser(channelId, user.id);
    setAccess(prev => [...prev, grant]);
  };

  const grantRole = async () => {
    if (!roleToGrant) return;
    const grant = await channelsApi.grantAccessToRole(channelId, roleToGrant);
    setAccess(prev => [...prev, grant]);
    setRoleToGrant('');
  };

  const revoke = async (accessId: string) => {
    await channelsApi.revokeAccess(channelId, accessId);
    setAccess(prev => prev.filter(a => a.id !== accessId));
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-black font-mono flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-green-800 text-sm">// channel not found, or you don&apos;t have access</p>
          <Link href="/channels" className="text-green-600 hover:text-green-400 text-xs">&larr; back to channels</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black font-mono flex flex-col">
      <header className="border-b border-green-900/40 bg-black shrink-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/channels" className="text-green-800 hover:text-green-500 text-xs shrink-0">&larr;</Link>
            <span className="text-green-600 shrink-0">{channel?.isPrivate ? <LockIcon /> : <HashIcon />}</span>
            <span className="text-green-400 font-bold text-sm truncate">{channel?.name ?? '...'}</span>
          </div>
          {isAdmin && channel?.isPrivate && (
            <button
              onClick={() => setShowManage(v => !v)}
              className="text-xs text-green-800 hover:text-green-500 border border-green-900/40 hover:border-green-700 px-3 py-1.5 rounded-sm transition-colors shrink-0"
            >
              {showManage ? 'close' : 'manage access'}
            </button>
          )}
        </div>
      </header>

      {showManage && (
        <div className="border-b border-green-900/40 bg-green-950/5">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 space-y-4">
            <div className="space-y-2">
              <p className="text-xs text-green-700 uppercase tracking-widest">grant to a person</p>
              <UserPicker onSelect={grantUser} placeholder="search users to grant access..." />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-green-700 uppercase tracking-widest">grant to a role</p>
              <div className="flex gap-2">
                <select
                  value={roleToGrant}
                  onChange={e => setRoleToGrant(e.target.value)}
                  className="flex-1 px-3 py-2 bg-black border border-green-900 rounded-sm text-green-300 text-sm font-mono focus:outline-none focus:border-green-500"
                >
                  <option value="">-- select a role --</option>
                  {allRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <button
                  onClick={grantRole}
                  disabled={!roleToGrant}
                  className="text-xs font-bold px-4 bg-green-500 text-black rounded-sm hover:bg-green-400 disabled:opacity-40 transition-colors uppercase tracking-wide"
                >
                  grant
                </button>
              </div>
              {allRoles.length === 0 && (
                <p className="text-[10px] text-green-950">// no roles created yet -- manage roles from the admin dashboard</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs text-green-700 uppercase tracking-widest">current access ({access.length})</p>
              {access.length === 0 && <p className="text-[10px] text-green-950">// nobody has been granted access yet</p>}
              {access.map(a => (
                <div key={a.id} className="flex items-center justify-between px-3 py-2 border border-green-900/40 rounded-sm text-xs">
                  <span className="text-green-400">
                    {a.user ? `@${a.user.username}` : `role: ${a.role?.name}`}
                  </span>
                  <button onClick={() => revoke(a.id)} className="text-red-500 hover:text-red-400 text-[10px] uppercase tracking-wide">
                    revoke
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-green-800 py-4">
              <div className="w-3 h-3 border-2 border-green-900 border-t-green-500 rounded-full animate-spin" />
              loading messages...
            </div>
          )}
          {!loading && messages.length === 0 && (
            <p className="text-xs text-green-950 py-4">// no messages yet -- say something</p>
          )}
          {messages.map(m => (
            <div key={m.id} className="flex gap-2 text-sm">
              <span className="text-green-600 shrink-0">@{m.author.username}</span>
              <span className="text-green-900 text-[10px] shrink-0 mt-0.5">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-green-300 break-words">{m.content}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

      <form onSubmit={handleSend} className="border-t border-green-900/40 bg-black shrink-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={`message #${channel?.name ?? ''}`}
            className="flex-1 px-3 py-2 bg-black border border-green-900 rounded-sm text-green-300 placeholder-green-900 focus:outline-none focus:border-green-500 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="text-xs font-bold px-4 bg-green-500 text-black rounded-sm hover:bg-green-400 disabled:opacity-40 transition-colors uppercase tracking-wide"
          >
            send
          </button>
        </div>
      </form>
    </div>
  );
}
