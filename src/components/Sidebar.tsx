'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { getTheme, setTheme, nextTheme, type Theme } from '@/lib/theme';
import { channels as channelsApi, friends as friendsApi, notifications as notificationsApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useSettings } from '@/lib/settings-context';
import { useToast } from '@/lib/toast-context';
import { playNotificationSound } from '@/lib/sound';
import { messagePreview } from '@/lib/attachments';
import { ChevronRightIcon, LockIcon, HashIcon, UsersIcon, SettingsIcon, MenuIcon, XIcon } from '@/components/Icons';
import type { Channel, FriendUser, NotificationSummary, ChatMessage, DirectMessageData } from '@/types';

const THEME_LABEL: Record<Theme, string> = {
  hacker: 'hacker',
  normal: 'normal',
  dark: 'dark',
};

const workspaceNav = [
  { href: '/tasks', label: 'my tasks', icon: '✓' },
  { href: '/roadmaps', label: 'roadmaps', icon: '▤' },
];

const communityLinks = [
  { href: '/community/find', label: 'find users', icon: '⌕' },
];

const communitySoon = [
  { label: 'whiteboard', icon: '▦' },
];

const POLL_MS = 5000;

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="text-[9px] bg-green-500 text-black rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-bold shrink-0">
      {count > 99 ? '99+' : count}
    </span>
  );
}

const navLinkCls = (active: boolean) =>
  `flex items-center gap-2 px-2 py-2 rounded-sm text-xs tracking-wide transition-colors border ${
    active
      ? 'bg-green-950/30 text-green-400 border-green-900/50'
      : 'text-green-700 hover:text-green-500 hover:bg-green-950/10 border-transparent'
  }`;

export default function Sidebar() {
  const pathname = usePathname();
  const selfId = getUser()?.id;
  const { notificationsEnabled, notificationSoundEnabled } = useSettings();
  const { showToast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setThemeState] = useState<Theme>('hacker');
  const [channelList, setChannelList] = useState<Channel[]>([]);
  const [friendList, setFriendList] = useState<FriendUser[]>([]);
  const [summary, setSummary] = useState<NotificationSummary>({ channels: {}, dms: {}, friendRequests: 0 });
  // Deterministic from the URL, so this is safe as an initial value -- no hydration mismatch risk.
  const [channelsExpanded, setChannelsExpanded] = useState(() => pathname?.startsWith('/channels') ?? false);
  const [dmExpanded, setDmExpanded] = useState(() => pathname?.startsWith('/friends') ?? false);

  // Read from localStorage only after mount, so the client's first render
  // matches the server-rendered HTML (avoids a hydration mismatch).
  useEffect(() => {
    setIsAdmin(!!getUser()?.isAdmin);
    setThemeState(getTheme());
  }, []);

  // Close the mobile drawer whenever the route actually changes -- tapping a
  // nav link should navigate and dismiss the overlay in one motion.
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const loadChannels = useCallback(async () => {
    try { setChannelList(await channelsApi.list()); }
    catch { /* not logged in yet, or request failed -- section just stays empty */ }
  }, []);

  const loadFriends = useCallback(async () => {
    try { setFriendList(await friendsApi.list()); }
    catch { /* not logged in yet, or request failed -- section just stays empty */ }
  }, []);

  const loadNotifications = useCallback(async () => {
    try { setSummary(await notificationsApi.summary()); }
    catch { /* not logged in yet, or request failed -- badges just stay at zero */ }
  }, []);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadChannels();
    loadFriends();
    loadNotifications();

    // The sidebar mounts once in the dashboard layout and persists across
    // client-side navigation -- it never remounts when you e.g. accept a
    // request on /friends, so without polling the incoming-request badge
    // (and channel/friend lists, and unread counts) would go stale for the
    // rest of the session.
    pollRef.current = setInterval(() => { loadChannels(); loadFriends(); loadNotifications(); }, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadChannels, loadFriends, loadNotifications]);

  // Keeps the shared socket joined to every channel/DM room the user has,
  // regardless of which page (if any) is currently open -- this is what lets
  // sound/popup notifications fire for chats you're not actively viewing.
  // Individual chat pages still emit their own 'join' when opened (harmless,
  // rooms are idempotent) but no longer 'leave' on unmount, since this is
  // now the thing responsible for that room staying joined.
  const joinedChannelsRef = useRef<Set<string>>(new Set());
  const joinedFriendsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const socket = getSocket();

    const syncRooms = () => {
      const channelIds = new Set(channelList.map(c => c.id));
      const friendIds = new Set(friendList.map(f => f.id));

      channelIds.forEach(id => {
        if (!joinedChannelsRef.current.has(id)) {
          socket.emit('channel:join', { channelId: id });
          joinedChannelsRef.current.add(id);
        }
      });
      joinedChannelsRef.current.forEach(id => {
        if (!channelIds.has(id)) {
          socket.emit('channel:leave', { channelId: id });
          joinedChannelsRef.current.delete(id);
        }
      });

      friendIds.forEach(id => {
        if (!joinedFriendsRef.current.has(id)) {
          socket.emit('dm:join', { friendId: id });
          joinedFriendsRef.current.add(id);
        }
      });
      joinedFriendsRef.current.forEach(id => {
        if (!friendIds.has(id)) {
          socket.emit('dm:leave', { friendId: id });
          joinedFriendsRef.current.delete(id);
        }
      });
    };

    if (socket.connected) syncRooms();

    // Room membership doesn't survive a reconnect -- everything needs
    // re-announcing, so drop what we thought was joined and resync clean.
    const handleReconnect = () => {
      joinedChannelsRef.current.clear();
      joinedFriendsRef.current.clear();
      syncRooms();
    };
    socket.on('connect', handleReconnect);
    return () => { socket.off('connect', handleReconnect); };
  }, [channelList, friendList]);

  // Sound + popup for messages from anyone else, in any room the socket is
  // joined to (see above) -- sound fires even if you're currently inside
  // that exact chat, the popup only fires if you're not.
  useEffect(() => {
    const socket = getSocket();

    const notify = (opts: { isActive: boolean; title: string; body: string; href: string }) => {
      if (!notificationsEnabled) return;
      if (notificationSoundEnabled) playNotificationSound();
      if (!opts.isActive) showToast({ title: opts.title, body: opts.body, href: opts.href });
    };

    const handleChannelMessage = (msg: ChatMessage) => {
      if (msg.author.id === selfId) return;
      const channelName = channelList.find(c => c.id === msg.channelId)?.name ?? 'channel';
      notify({
        isActive: pathname === `/channels/${msg.channelId}`,
        title: `#${channelName}`,
        body: `${msg.author.username}: ${messagePreview(msg.content, msg.attachmentType)}`,
        href: `/channels/${msg.channelId}`,
      });
    };

    const handleDmMessage = (msg: DirectMessageData) => {
      if (msg.senderId === selfId) return;
      notify({
        isActive: pathname === `/friends/${msg.senderId}`,
        title: `@${msg.sender.username}`,
        body: messagePreview(msg.content, msg.attachmentType),
        href: `/friends/${msg.senderId}`,
      });
    };

    socket.on('channel:message', handleChannelMessage);
    socket.on('dm:message', handleDmMessage);
    return () => {
      socket.off('channel:message', handleChannelMessage);
      socket.off('dm:message', handleDmMessage);
    };
  }, [channelList, pathname, selfId, notificationsEnabled, notificationSoundEnabled, showToast]);

  const channelUnreadTotal = Object.values(summary.channels).reduce((a, b) => a + b, 0);
  const dmUnreadTotal = Object.values(summary.dms).reduce((a, b) => a + b, 0);

  const cycleTheme = () => {
    const next = nextTheme(theme);
    setTheme(next);
    setThemeState(next);
  };

  return (
    <>
      {/* Mobile-only top bar -- collapses to nothing at md: and up, where
          the sidebar itself is always visible as a static column instead. */}
      <div className="md:hidden shrink-0 flex items-center justify-between px-4 py-3 border-b border-green-900/40 bg-black">
        <button onClick={() => setMobileOpen(true)} className="text-green-500" aria-label="open menu">
          <MenuIcon className="w-5 h-5" />
        </button>
        <span className="text-green-400 font-bold tracking-widest text-sm">TASKFLOW</span>
        <span className="w-5" aria-hidden="true" />
      </div>

      {/* Backdrop -- only exists (and only matters) while the mobile drawer is open */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`w-64 md:w-56 shrink-0 border-r border-green-900/40 bg-black h-full flex flex-col font-mono
          fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out
          md:static md:z-auto md:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-4 py-4 border-b border-green-900/40 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-green-500 text-lg font-bold">&gt;_</span>
            <span className="text-green-400 font-bold tracking-widest text-sm">TASKFLOW</span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="md:hidden text-green-900 hover:text-green-500" aria-label="close menu">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        <div className="px-2 pb-1 text-[10px] text-green-900 tracking-widest uppercase">workspace</div>
        {workspaceNav.map(item => (
          <Link key={item.href} href={item.href} className={navLinkCls(!!pathname?.startsWith(item.href))}>
            <span className="w-4 text-center">{item.icon}</span>
            <span className="uppercase">{item.label}</span>
          </Link>
        ))}

        <div className="px-2 pt-6 pb-1 text-[10px] text-green-900 tracking-widest uppercase">community</div>
        {communityLinks.map(item => (
          <Link key={item.href} href={item.href} className={navLinkCls(!!pathname?.startsWith(item.href))}>
            <span className="w-4 text-center">{item.icon}</span>
            <span className="uppercase">{item.label}</span>
          </Link>
        ))}

        {/* Friends -- its own top-level tab (request management), separate from the DM chat list below */}
        <Link href="/friends" className={navLinkCls(pathname === '/friends')}>
          <span className="w-4 text-center"><UsersIcon className="w-3.5 h-3.5" /></span>
          <span className="uppercase flex-1">friends</span>
          <CountBadge count={summary.friendRequests} />
        </Link>

        {/* Channels -- Discord-style: click to expand/collapse the channel list in place */}
        <button
          onClick={() => setChannelsExpanded(v => !v)}
          className={navLinkCls(false) + ' w-full'}
        >
          <ChevronRightIcon className={`w-3 h-3 shrink-0 transition-transform duration-200 ${channelsExpanded ? 'rotate-90' : ''}`} />
          <span className="uppercase flex-1 text-left">channels</span>
          <CountBadge count={channelUnreadTotal} />
        </button>

        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${channelsExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <div className="overflow-hidden">
            <div className="pl-4 space-y-1 pb-1">
              {channelList.length === 0 && (
                <p className="px-2 py-1 text-[10px] text-green-950">// none yet</p>
              )}
              {channelList.map(ch => (
                <Link
                  key={ch.id}
                  href={`/channels/${ch.id}`}
                  className={navLinkCls(pathname === `/channels/${ch.id}`)}
                >
                  <span className="w-4 text-center">{ch.isPrivate ? <LockIcon className="w-3 h-3" /> : <HashIcon className="w-3 h-3" />}</span>
                  <span className="truncate flex-1">{ch.name}</span>
                  <CountBadge count={summary.channels[ch.id] ?? 0} />
                </Link>
              ))}
              {isAdmin && (
                <Link href="/channels" className="block px-2 py-1.5 text-[10px] text-green-800 hover:text-green-500 uppercase tracking-wide">
                  manage channels &rarr;
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Direct messages -- same expand pattern, list is just your friends list */}
        <button
          onClick={() => setDmExpanded(v => !v)}
          className={navLinkCls(false) + ' w-full'}
        >
          <ChevronRightIcon className={`w-3 h-3 shrink-0 transition-transform duration-200 ${dmExpanded ? 'rotate-90' : ''}`} />
          <span className="uppercase flex-1 text-left">direct messages</span>
          <CountBadge count={dmUnreadTotal} />
        </button>

        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${dmExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <div className="overflow-hidden">
            <div className="pl-4 space-y-1 pb-1">
              {friendList.length === 0 && (
                <p className="px-2 py-1 text-[10px] text-green-950">// no friends yet</p>
              )}
              {friendList.map(f => (
                <Link
                  key={f.id}
                  href={`/friends/${f.id}`}
                  className={navLinkCls(pathname === `/friends/${f.id}`)}
                >
                  <span className="w-4 text-center">@</span>
                  <span className="truncate flex-1">{f.username}</span>
                  <CountBadge count={summary.dms[f.id] ?? 0} />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="px-2 pt-6 pb-1 text-[10px] text-green-900 tracking-widest uppercase">preferences</div>
        <Link href="/settings" className={navLinkCls(pathname === '/settings')}>
          <span className="w-4 text-center"><SettingsIcon className="w-3.5 h-3.5" /></span>
          <span className="uppercase">settings</span>
        </Link>

        {communitySoon.map(item => (
          <div
            key={item.label}
            title="coming soon"
            className="flex items-center gap-2 px-2 py-2 rounded-sm text-xs tracking-wide text-green-950 cursor-not-allowed select-none"
          >
            <span className="w-4 text-center">{item.icon}</span>
            <span className="uppercase">{item.label}</span>
          </div>
        ))}

        {isAdmin && (
          <>
            <div className="px-2 pt-6 pb-1 text-[10px] text-green-900 tracking-widest uppercase">admin</div>
            <Link href="/admin" className={navLinkCls(!!pathname?.startsWith('/admin'))}>
              <span className="w-4 text-center">⚙</span>
              <span className="uppercase">access control</span>
            </Link>
          </>
        )}
      </nav>

      <div className="px-4 py-3 border-t border-green-900/40 space-y-2">
        <button
          onClick={cycleTheme}
          title={`switch to ${THEME_LABEL[nextTheme(theme)]}`}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-sm text-[10px] text-green-800 hover:text-green-500 hover:bg-green-950/10 border border-green-900/40 transition-colors uppercase tracking-widest"
        >
          <span>theme</span>
          <span className="text-green-600">{THEME_LABEL[theme]} ▸</span>
        </button>
        <p className="text-[10px] text-green-950">v0.1 // more coming soon</p>
      </div>
      </aside>
    </>
  );
}
