'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { channels as channelsApi, roles as rolesApi, type SendMessagePayload } from '@/lib/api';
import { isAuthenticated, getUser } from '@/lib/auth';
import { getSocket } from '@/lib/socket';
import { userColor } from '@/lib/userColor';
import { ONLINE_COLOR } from '@/lib/statusColors';
import UserPicker from '@/components/UserPicker';
import ChannelMembersModal from '@/components/ChannelMembersModal';
import ChatComposer from '@/components/ChatComposer';
import MessageAttachment from '@/components/MessageAttachment';
import CodeEditorPanel from '@/components/CodeEditorPanel';
import { LockIcon, HashIcon, CodeIcon } from '@/components/Icons';
import type { Channel, ChatMessage, ChannelAccessGrant, Role, ChannelMember } from '@/types';

// "@alice is typing...", "@alice & @bob are typing...",
// "@alice & 10 others are typing..." -- collapses past two names rather
// than letting a busy channel's indicator grow unbounded.
function formatTypingLabel(entries: { username: string; status: 'typing' | 'recording' }[]): string {
  if (entries.length === 0) return '';
  if (entries.length === 1) {
    const [e] = entries;
    return `@${e.username} is ${e.status === 'recording' ? 'recording a voice message' : 'typing'}...`;
  }
  if (entries.length === 2) {
    return `@${entries[0].username} & @${entries[1].username} are typing...`;
  }
  return `@${entries[0].username} & ${entries.length - 1} others are typing...`;
}

export default function ChannelPage() {
  const router = useRouter();
  const params = useParams();
  const channelId = params.id as string;

  const [channel, setChannel] = useState<Channel | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showManage, setShowManage] = useState(false);

  const [access, setAccess] = useState<ChannelAccessGrant[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [roleToGrant, setRoleToGrant] = useState('');

  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Other members currently composing a message in this channel, keyed by
  // userId. Each entry carries its own auto-clear timeout (see the
  // 'channel:typing' handler below) as a safety net in case an explicit
  // "stopped" event never arrives (closed tab, dropped connection, etc).
  const [typingUsers, setTypingUsers] = useState<Record<string, { username: string; status: 'typing' | 'recording' }>>({});
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const bottomRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const selfId = getUser()?.id;

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior }));
  };

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

  // Resets to the latest page -- used on first mount and on reconnect.
  const loadMessages = useCallback(async () => {
    try {
      const page = await channelsApi.listMessages(channelId, { limit: 15 });
      setMessages(page.messages);
      setHasMore(page.hasMore);
    } catch { /* access revoked mid-session, etc -- just stop showing new ones */ }
  }, [channelId]);

  // Pages backwards from the oldest message currently loaded, prepending
  // the older batch. Keeps the viewport anchored on whatever the user was
  // already reading rather than yanking it as the content above grows.
  const loadMore = async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const container = mainRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    try {
      const page = await channelsApi.listMessages(channelId, { limit: 15, before: messages[0].createdAt });
      setMessages(prev => [...page.messages, ...prev]);
      setHasMore(page.hasMore);
      requestAnimationFrame(() => {
        if (container) container.scrollTop += container.scrollHeight - prevScrollHeight;
      });
    } catch { /* ignore -- the load more button just stays put */ }
    finally { setLoadingMore(false); }
  };

  useEffect(() => {
    setLoading(true);
    setTypingUsers({});
    Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
    typingTimeoutsRef.current = {};
    Promise.all([loadChannel(), loadMessages()])
      .then(() => channelsApi.markRead(channelId))
      .catch(() => { /* not a member, etc -- nothing to mark read */ })
      .finally(() => { setLoading(false); scrollToBottom('auto'); });

    const socket = getSocket();
    const join = () => socket.emit('channel:join', { channelId });
    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.channelId !== channelId) return; // shared socket, guard against cross-room events
      // The sender already appended their own message optimistically on send
      // (see handleSend) and is also joined to this room, so the broadcast
      // for that same message comes right back -- dedupe by id.
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      scrollToBottom();
      // Page is open and the message just landed in view -- keep the
      // sidebar's unread badge from lighting up for something already seen.
      channelsApi.markRead(channelId).catch(() => {});
      // A message from someone landing clears their typing indicator
      // immediately rather than waiting for its own auto-clear timeout.
      setTypingUsers(prev => {
        if (!prev[msg.authorId]) return prev;
        const next = { ...prev };
        delete next[msg.authorId];
        return next;
      });
    };
    const handleTyping = (data: { channelId: string; userId: string; username: string; status: 'typing' | 'recording' | null }) => {
      if (data.channelId !== channelId || data.userId === selfId) return;
      if (typingTimeoutsRef.current[data.userId]) clearTimeout(typingTimeoutsRef.current[data.userId]);
      if (!data.status) {
        delete typingTimeoutsRef.current[data.userId];
        setTypingUsers(prev => {
          if (!prev[data.userId]) return prev;
          const next = { ...prev };
          delete next[data.userId];
          return next;
        });
        return;
      }
      setTypingUsers(prev => ({ ...prev, [data.userId]: { username: data.username, status: data.status! } }));
      scrollToBottom();
      // Safety net -- clears a stuck indicator if the "stopped" event never
      // arrives (tab closed, connection dropped mid-recording, etc).
      typingTimeoutsRef.current[data.userId] = setTimeout(() => {
        setTypingUsers(prev => {
          const next = { ...prev };
          delete next[data.userId];
          return next;
        });
      }, 5000);
    };
    // Socket.IO room membership isn't preserved across a reconnect -- the
    // server has to be told again which room to rejoin. Also re-fetch
    // history here to reconcile anything sent while we were disconnected.
    const handleReconnect = () => { join(); loadMessages().then(() => scrollToBottom('auto')); };

    if (socket.connected) join();
    socket.on('connect', handleReconnect);
    socket.on('channel:message', handleNewMessage);
    socket.on('channel:typing', handleTyping);

    // Deliberately no 'channel:leave' here -- the sidebar (mounted for the
    // whole session) keeps every accessible channel's room joined so it can
    // fire sound/popup notifications from anywhere, not just this page.
    return () => {
      socket.off('connect', handleReconnect);
      socket.off('channel:message', handleNewMessage);
      socket.off('channel:typing', handleTyping);
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
    };
  }, [channelId, loadChannel, loadMessages, selfId]);

  const handleTypingChange = (status: 'typing' | 'recording' | null) => {
    getSocket().emit('channel:typing', { channelId, status });
  };

  const loadManageData = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([channelsApi.listAccess(channelId), rolesApi.list()]);
      setAccess(a);
      setAllRoles(r);
    } catch { /* not admin, or no access */ }
  }, [channelId]);

  useEffect(() => { if (showManage) loadManageData(); }, [showManage, loadManageData]);

  const openMembers = () => {
    setShowMembers(true);
    setMembersLoading(true);
    channelsApi.listMembers(channelId)
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false));
  };

  const handleSend = async (payload: SendMessagePayload, replaceTempId?: string) => {
    const msg = await channelsApi.sendMessage(channelId, payload);
    setMessages(prev => {
      // Swap the optimistic placeholder for the real, server-saved message
      // rather than just appending -- otherwise both would show at once.
      const withoutTemp = replaceTempId ? prev.filter(m => m.id !== replaceTempId) : prev;
      // The socket broadcast for this same message can arrive over the
      // already-open connection before this request's response does --
      // dedupe here too, not just in the socket handler.
      return withoutTemp.some(m => m.id === msg.id) ? withoutTemp : [...withoutTemp, msg];
    });
    scrollToBottom();
  };

  // Shows a voice message immediately using the local recording, before the
  // upload to Cloudinary (the slow part) has even started.
  const handleOptimisticVoiceSend = (tempId: string, preview: { url: string; durationSeconds: number; name: string }) => {
    const self = getUser();
    const optimisticMsg: ChatMessage = {
      id: tempId,
      attachmentUrl: preview.url,
      attachmentType: 'audio',
      attachmentName: preview.name,
      attachmentDuration: preview.durationSeconds,
      channelId,
      authorId: self?.id ?? '',
      author: { id: self?.id ?? '', username: self?.username ?? 'you' },
      createdAt: new Date().toISOString(),
      sending: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();
  };

  const handleOptimisticFailed = (tempId: string) => {
    setMessages(prev => prev.filter(m => m.id !== tempId));
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

  // A code channel is an ordinary channel plus an editor -- every piece of
  // chat state and behavior above is shared, only the layout below differs.
  const isCodeChannel = channel?.kind === 'CODE';

  return (
    <div className="h-full overflow-hidden bg-black font-mono flex flex-col">
      <header className="border-b border-green-900/40 bg-black shrink-0">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/channels" className="text-green-800 hover:text-green-500 text-xs shrink-0">&larr;</Link>
            <span className="text-green-600 shrink-0">
              {channel?.kind === 'CODE' ? <CodeIcon /> : channel?.isPrivate ? <LockIcon /> : <HashIcon />}
            </span>
            <button
              onClick={openMembers}
              disabled={!channel}
              title="view members"
              className="text-green-400 font-bold text-sm truncate hover:text-green-300 hover:underline decoration-green-700 underline-offset-2 transition-colors disabled:no-underline"
            >
              {channel?.name ?? '...'}
            </button>
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

      {/*
        In a TEXT channel these wrappers collapse to `display: contents`, so
        the message list and composer stay direct children of the page
        column exactly as before -- the chat layout is untouched. In a CODE
        channel they become a real split: editor on the left, the same chat
        narrowed to a column on the right (stacked vertically below lg).
      */}
      <div className={isCodeChannel ? 'flex-1 min-h-0 flex flex-col lg:flex-row' : 'contents'}>
        {isCodeChannel && (
          <div className="h-1/2 lg:h-auto lg:flex-1 min-h-0 border-b lg:border-b-0 lg:border-r border-green-900/40">
            <CodeEditorPanel channelId={channelId} />
          </div>
        )}

        <div className={isCodeChannel ? 'flex flex-col min-h-0 flex-1 lg:flex-none lg:w-[380px]' : 'contents'}>
          <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            <div className="px-4 sm:px-6 py-4 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-green-800 py-4">
              <div className="w-3 h-3 border-2 border-green-900 border-t-green-500 rounded-full animate-spin" />
              loading messages...
            </div>
          )}
          {!loading && messages.length === 0 && (
            <p className="text-xs text-green-950 py-4">// no messages yet -- say something</p>
          )}
          {!loading && hasMore && (
            <div className="flex justify-center pb-1">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="text-[10px] text-green-800 hover:text-green-500 border border-green-900/40 hover:border-green-700 px-3 py-1.5 rounded-sm transition-colors disabled:opacity-40 uppercase tracking-wide"
              >
                {loadingMore ? 'loading...' : 'load more'}
              </button>
            </div>
          )}
          {messages.map((m, i) => {
            const mine = m.author.id === selfId;
            const timeStr = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div
                key={m.id}
                className={`flex animate-enter ${mine ? 'justify-end' : 'justify-start'}`}
                style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
              >
                <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl border text-sm break-words transition-colors ${
                  mine
                    ? 'rounded-br-md bg-green-950/20 border-green-800/50 text-green-300'
                    : 'rounded-bl-md bg-black border-green-900/40 text-green-400'
                } ${m.sending ? 'opacity-60' : ''}`}>
                  <p className="text-xs font-bold mb-0.5" style={{ color: mine ? ONLINE_COLOR : userColor(m.author.id) }}>
                    {mine ? 'you' : `@${m.author.username}`}
                  </p>
                  {m.sending && (
                    <div className="flex items-center gap-1.5 text-[10px] text-green-800 mb-1">
                      <div className="w-2.5 h-2.5 border-2 border-green-900 border-t-green-500 rounded-full animate-spin shrink-0" />
                      sending...
                    </div>
                  )}
                  {m.content}
                  {m.attachmentUrl && (
                    <MessageAttachment url={m.attachmentUrl} type={m.attachmentType} name={m.attachmentName} timestamp={timeStr} duration={m.attachmentDuration} />
                  )}
                  {m.attachmentType !== 'audio' && (
                    <div className="text-[9px] text-green-900 mt-1 text-right">{timeStr}</div>
                  )}
                </div>
              </div>
            );
          })}
          {Object.keys(typingUsers).length > 0 && (
            <div className="flex justify-start animate-enter">
              <div className="max-w-[75%] px-3.5 py-2 rounded-2xl rounded-bl-md border bg-black border-green-900/40 text-green-500 text-xs italic flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse shrink-0" />
                {formatTypingLabel(Object.values(typingUsers))}
              </div>
            </div>
          )}
              <div ref={bottomRef} />
            </div>
          </main>

          <ChatComposer
            placeholder={`message #${channel?.name ?? ''}`}
            onSend={handleSend}
            onOptimisticSend={handleOptimisticVoiceSend}
            onOptimisticFailed={handleOptimisticFailed}
            onTypingChange={handleTypingChange}
          />
        </div>
      </div>

      {showMembers && (
        <ChannelMembersModal
          channelName={channel?.name ?? ''}
          members={members}
          loading={membersLoading}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>
  );
}
