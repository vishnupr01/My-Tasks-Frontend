'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { getTheme, setTheme, nextTheme, type Theme } from '@/lib/theme';
import { channels as channelsApi } from '@/lib/api';
import { ChevronRightIcon, LockIcon, HashIcon } from '@/components/Icons';
import type { Channel } from '@/types';

const THEME_LABEL: Record<Theme, string> = {
  hacker: 'hacker',
  normal: 'normal',
  dark: 'dark',
};

const workspaceNav = [
  { href: '/tasks', label: 'my tasks', icon: '✓' },
];

const communityLinks = [
  { href: '/community/find', label: 'find users', icon: '⌕' },
];

const communitySoon = [
  { label: 'direct messages', icon: '@' },
  { label: 'whiteboard', icon: '▦' },
];

const navLinkCls = (active: boolean) =>
  `flex items-center gap-2 px-2 py-2 rounded-sm text-xs tracking-wide transition-colors border ${
    active
      ? 'bg-green-950/30 text-green-400 border-green-900/50'
      : 'text-green-700 hover:text-green-500 hover:bg-green-950/10 border-transparent'
  }`;

export default function Sidebar() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [theme, setThemeState] = useState<Theme>('hacker');
  const [channelList, setChannelList] = useState<Channel[]>([]);
  // Deterministic from the URL, so this is safe as an initial value -- no hydration mismatch risk.
  const [channelsExpanded, setChannelsExpanded] = useState(() => pathname?.startsWith('/channels') ?? false);

  // Read from localStorage only after mount, so the client's first render
  // matches the server-rendered HTML (avoids a hydration mismatch).
  useEffect(() => {
    setIsAdmin(!!getUser()?.isAdmin);
    setThemeState(getTheme());
  }, []);

  const loadChannels = useCallback(async () => {
    try { setChannelList(await channelsApi.list()); }
    catch { /* not logged in yet, or request failed -- section just stays empty */ }
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  const cycleTheme = () => {
    const next = nextTheme(theme);
    setTheme(next);
    setThemeState(next);
  };

  return (
    <aside className="w-56 shrink-0 border-r border-green-900/40 bg-black min-h-screen flex flex-col font-mono">
      <div className="px-4 py-4 border-b border-green-900/40 flex items-center gap-2">
        <span className="text-green-500 text-lg font-bold">&gt;_</span>
        <span className="text-green-400 font-bold tracking-widest text-sm">TASKFLOW</span>
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

        {/* Channels -- Discord-style: click to expand/collapse the channel list in place */}
        <button
          onClick={() => setChannelsExpanded(v => !v)}
          className={navLinkCls(false) + ' w-full'}
        >
          <ChevronRightIcon className={`w-3 h-3 shrink-0 transition-transform duration-200 ${channelsExpanded ? 'rotate-90' : ''}`} />
          <span className="uppercase flex-1 text-left">channels</span>
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
                  <span className="truncate">{ch.name}</span>
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
  );
}
