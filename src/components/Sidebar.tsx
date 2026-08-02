'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUser } from '@/lib/auth';

const workspaceNav = [
  { href: '/tasks', label: 'my tasks', icon: '✓' },
];

const communityLinks = [
  { href: '/community/find', label: 'find users', icon: '⌕' },
];

const communitySoon = [
  { label: 'channels', icon: '#' },
  { label: 'direct messages', icon: '@' },
  { label: 'whiteboard', icon: '▦' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  // Read from localStorage only after mount, so the client's first render
  // matches the server-rendered HTML (avoids a hydration mismatch).
  useEffect(() => { setIsAdmin(!!getUser()?.isAdmin); }, []);

  return (
    <aside className="w-56 shrink-0 border-r border-green-900/40 bg-black min-h-screen flex flex-col font-mono">
      <div className="px-4 py-4 border-b border-green-900/40 flex items-center gap-2">
        <span className="text-green-500 text-lg font-bold">&gt;_</span>
        <span className="text-green-400 font-bold tracking-widest text-sm">TASKFLOW</span>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        <div className="px-2 pb-1 text-[10px] text-green-900 tracking-widest uppercase">workspace</div>
        {workspaceNav.map(item => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-2 py-2 rounded-sm text-xs tracking-wide transition-colors border ${
                active
                  ? 'bg-green-950/30 text-green-400 border-green-900/50'
                  : 'text-green-700 hover:text-green-500 hover:bg-green-950/10 border-transparent'
              }`}
            >
              <span className="w-4 text-center">{item.icon}</span>
              <span className="uppercase">{item.label}</span>
            </Link>
          );
        })}

        <div className="px-2 pt-6 pb-1 text-[10px] text-green-900 tracking-widest uppercase">community</div>
        {communityLinks.map(item => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-2 py-2 rounded-sm text-xs tracking-wide transition-colors border ${
                active
                  ? 'bg-green-950/30 text-green-400 border-green-900/50'
                  : 'text-green-700 hover:text-green-500 hover:bg-green-950/10 border-transparent'
              }`}
            >
              <span className="w-4 text-center">{item.icon}</span>
              <span className="uppercase">{item.label}</span>
            </Link>
          );
        })}
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
            <Link
              href="/admin"
              className={`flex items-center gap-2 px-2 py-2 rounded-sm text-xs tracking-wide transition-colors border ${
                pathname?.startsWith('/admin')
                  ? 'bg-green-950/30 text-green-400 border-green-900/50'
                  : 'text-green-700 hover:text-green-500 hover:bg-green-950/10 border-transparent'
              }`}
            >
              <span className="w-4 text-center">⚙</span>
              <span className="uppercase">access control</span>
            </Link>
          </>
        )}
      </nav>

      <div className="px-4 py-3 border-t border-green-900/40 text-[10px] text-green-950">
        v0.1 // more coming soon
      </div>
    </aside>
  );
}
