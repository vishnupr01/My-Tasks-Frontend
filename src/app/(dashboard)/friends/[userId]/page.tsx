'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { friends as friendsApi, type SendMessagePayload } from '@/lib/api';
import { isAuthenticated, getUser } from '@/lib/auth';
import { getSocket } from '@/lib/socket';
import { usePresence } from '@/lib/presence-context';
import { ONLINE_COLOR, OFFLINE_COLOR } from '@/lib/statusColors';
import ChatComposer from '@/components/ChatComposer';
import MessageAttachment from '@/components/MessageAttachment';
import type { DirectMessageData, FriendUser } from '@/types';

export default function DirectMessagePage() {
  const router = useRouter();
  const params = useParams();
  const friendId = params.userId as string;

  const [friend, setFriend] = useState<FriendUser | null>(null);
  const [notFriend, setNotFriend] = useState(false);
  const [messages, setMessages] = useState<DirectMessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const selfId = getUser()?.id;
  const { isOnline } = usePresence();
  const friendOnline = isOnline(friendId);

  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Safety-net auto-clear (see the 'dm:typing' handler below) in case an
  // explicit "stopped" event never arrives.
  const [friendTyping, setFriendTyping] = useState<'typing' | 'recording' | null>(null);
  const friendTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior }));
  };

  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);

  const loadFriend = useCallback(async () => {
    try {
      const list = await friendsApi.list();
      const found = list.find(f => f.id === friendId);
      if (!found) { setNotFriend(true); return; }
      setFriend(found);
    } catch { setNotFriend(true); }
  }, [friendId]);

  // Resets to the latest page -- used on first mount and on reconnect.
  const loadMessages = useCallback(async () => {
    try {
      const page = await friendsApi.listMessages(friendId, { limit: 15 });
      setMessages(page.messages);
      setHasMore(page.hasMore);
    } catch { /* not friends (any more), or a transient failure -- just stop refreshing */ }
  }, [friendId]);

  // Pages backwards from the oldest message currently loaded, prepending
  // the older batch. Keeps the viewport anchored on whatever the user was
  // already reading rather than yanking it as the content above grows.
  const loadMore = async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const container = mainRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    try {
      const page = await friendsApi.listMessages(friendId, { limit: 15, before: messages[0].createdAt });
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
    setFriendTyping(null);
    if (friendTypingTimeoutRef.current) { clearTimeout(friendTypingTimeoutRef.current); friendTypingTimeoutRef.current = null; }
    Promise.all([loadFriend(), loadMessages()])
      .then(() => friendsApi.markRead(friendId))
      .catch(() => { /* not friends, etc -- nothing to mark read */ })
      .finally(() => { setLoading(false); scrollToBottom('auto'); });

    const socket = getSocket();
    const join = () => socket.emit('dm:join', { friendId });
    const handleNewMessage = (msg: DirectMessageData) => {
      // Defensive: only this one dm room should ever reach us, but guard
      // against a stale listener from a previous friendId anyway.
      if (msg.senderId !== friendId && msg.senderId !== selfId) return;
      // The sender already appended their own message optimistically on send
      // (see handleSend) and is also joined to this dm room, so the
      // broadcast for that same message comes right back -- dedupe by id.
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      scrollToBottom();
      // Page is open and the message just landed in view -- keep the
      // sidebar's unread badge from lighting up for something already seen.
      friendsApi.markRead(friendId).catch(() => {});
      // A message landing clears the typing indicator immediately rather
      // than waiting for its own auto-clear timeout.
      if (msg.senderId === friendId) setFriendTyping(null);
    };
    const handleTyping = (data: { userId: string; status: 'typing' | 'recording' | null }) => {
      if (data.userId !== friendId) return;
      if (friendTypingTimeoutRef.current) { clearTimeout(friendTypingTimeoutRef.current); friendTypingTimeoutRef.current = null; }
      setFriendTyping(data.status ?? null);
      if (data.status) {
        scrollToBottom();
        friendTypingTimeoutRef.current = setTimeout(() => setFriendTyping(null), 5000);
      }
    };
    const handleReconnect = () => { join(); loadMessages().then(() => scrollToBottom('auto')); };

    if (socket.connected) join();
    socket.on('connect', handleReconnect);
    socket.on('dm:message', handleNewMessage);
    socket.on('dm:typing', handleTyping);

    // Deliberately no 'dm:leave' here -- the sidebar (mounted for the whole
    // session) keeps every friend's DM room joined so it can fire
    // sound/popup notifications from anywhere, not just this page.
    return () => {
      socket.off('connect', handleReconnect);
      socket.off('dm:message', handleNewMessage);
      socket.off('dm:typing', handleTyping);
      if (friendTypingTimeoutRef.current) clearTimeout(friendTypingTimeoutRef.current);
    };
  }, [friendId, loadFriend, loadMessages, selfId]);

  const handleTypingChange = (status: 'typing' | 'recording' | null) => {
    getSocket().emit('dm:typing', { friendId, status });
  };

  const handleSend = async (payload: SendMessagePayload, replaceTempId?: string) => {
    const msg = await friendsApi.sendMessage(friendId, payload);
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
    const optimisticMsg: DirectMessageData = {
      id: tempId,
      attachmentUrl: preview.url,
      attachmentType: 'audio',
      attachmentName: preview.name,
      attachmentDuration: preview.durationSeconds,
      conversationId: '',
      senderId: self?.id ?? '',
      sender: { id: self?.id ?? '', username: self?.username ?? 'you' },
      createdAt: new Date().toISOString(),
      sending: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();
  };

  const handleOptimisticFailed = (tempId: string) => {
    setMessages(prev => prev.filter(m => m.id !== tempId));
  };

  if (notFriend) {
    return (
      <div className="min-h-screen bg-black font-mono flex items-center justify-center">
        <div className="text-center space-y-2 animate-enter">
          <p className="text-green-800 text-sm">// you're not friends with this user</p>
          <Link href="/friends" className="text-green-600 hover:text-green-400 text-xs">&larr; back to friends</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-black font-mono flex flex-col">
      <header className="border-b border-green-900/40 bg-black shrink-0">
        <div className="px-4 sm:px-6 py-3 flex items-center gap-2">
          <Link href="/friends" className="text-green-800 hover:text-green-500 text-xs shrink-0">&larr;</Link>
          <div className="relative shrink-0">
            <div className="w-6 h-6 rounded-sm bg-green-950/30 border border-green-900/50 flex items-center justify-center text-green-500 text-[10px] font-bold">
              {friend?.username?.[0]?.toUpperCase() ?? '?'}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black"
              style={{ backgroundColor: friendOnline ? ONLINE_COLOR : OFFLINE_COLOR }}
              title={friendOnline ? 'online' : 'offline'}
            />
          </div>
          <div className="min-w-0">
            <span className="text-green-400 font-bold text-sm truncate block">{friend ? `@${friend.username}` : '...'}</span>
            <span className="text-[10px] block" style={{ color: friend ? (friendOnline ? ONLINE_COLOR : OFFLINE_COLOR) : undefined }}>
              {friend ? (friendOnline ? 'online' : 'offline') : ''}
            </span>
          </div>
        </div>
      </header>

      <main ref={mainRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="px-4 sm:px-6 py-4 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-green-800 py-4">
              <div className="w-3 h-3 border-2 border-green-900 border-t-green-500 rounded-full animate-spin" />
              loading messages...
            </div>
          )}
          {!loading && messages.length === 0 && (
            <p className="text-xs text-green-950 py-4 animate-enter">// no messages yet -- say hi</p>
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
            const mine = m.senderId === selfId;
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
          {friendTyping && (
            <div className="flex justify-start animate-enter">
              <div className="max-w-[75%] px-3.5 py-2 rounded-2xl rounded-bl-md border bg-black border-green-900/40 text-green-500 text-xs italic flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse shrink-0" />
                {friendTyping === 'recording' ? 'recording a voice message...' : 'typing...'}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <ChatComposer
        placeholder={friend ? `message @${friend.username}` : 'message...'}
        onSend={handleSend}
        onOptimisticSend={handleOptimisticVoiceSend}
        onOptimisticFailed={handleOptimisticFailed}
        onTypingChange={handleTypingChange}
      />
    </div>
  );
}
