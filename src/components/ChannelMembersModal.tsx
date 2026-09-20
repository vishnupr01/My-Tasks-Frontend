'use client';

import { useEffect, useRef } from 'react';
import { usePresence } from '@/lib/presence-context';
import { ONLINE_COLOR, OFFLINE_COLOR } from '@/lib/statusColors';
import type { ChannelMember } from '@/types';

interface ChannelMembersModalProps {
  channelName: string;
  members: ChannelMember[];
  loading: boolean;
  onClose: () => void;
}

function MemberRow({ member, online }: { member: ChannelMember; online: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 px-2 py-1.5 rounded-sm transition-colors ${online ? 'hover:bg-green-950/20' : 'opacity-50'}`}>
      <div className="relative shrink-0">
        <div className="w-7 h-7 rounded-full bg-green-950/40 border border-green-900/50 flex items-center justify-center text-green-400 text-[11px] font-bold">
          {member.username[0]?.toUpperCase()}
        </div>
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black"
          style={{ backgroundColor: online ? ONLINE_COLOR : OFFLINE_COLOR }}
        />
      </div>
      <span className="text-sm text-green-300 truncate flex-1">@{member.username}</span>
      {member.isAdmin && (
        <span className="text-[9px] text-yellow-500 border border-yellow-900/50 rounded-sm px-1.5 py-0.5 shrink-0 uppercase tracking-wide">admin</span>
      )}
    </div>
  );
}

// Anchored popover, not a full-screen modal -- no dark backdrop, so the
// channel behind it stays visible. Closes on Escape or on a click outside
// the panel itself.
export default function ChannelMembersModal({ channelName, members, loading, onClose }: ChannelMembersModalProps) {
  const { isOnline } = usePresence();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', handleKey);
    // Registered on the next tick so the click that opened this panel
    // doesn't immediately bubble into this listener and close it again.
    const id = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    return () => {
      window.removeEventListener('keydown', handleKey);
      clearTimeout(id);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const online = members.filter(m => isOnline(m.id));
  const offline = members.filter(m => !isOnline(m.id));

  return (
    <div
      ref={panelRef}
      className="fixed top-24 md:top-16 left-4 sm:left-6 z-50 w-72 max-w-[calc(100vw-2rem)] bg-black border border-green-900/60 rounded-sm shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_24px_rgba(var(--glow-rgb),calc(0.08*var(--glow-mult)))] flex flex-col max-h-[26rem] font-mono animate-enter"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-green-900/40 bg-green-950/10 shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-green-400 text-xs font-bold uppercase tracking-widest truncate">#{channelName}</p>
          <p className="text-green-900 text-[10px]">{members.length} member{members.length === 1 ? '' : 's'}</p>
        </div>
        <button onClick={onClose} className="text-green-900 hover:text-green-500 text-sm shrink-0" title="close [esc]">
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-green-800 py-4 px-1">
            <div className="w-3 h-3 border-2 border-green-900 border-t-green-500 rounded-full animate-spin" />
            loading members...
          </div>
        )}

        {!loading && (
          <>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 px-2 pb-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ONLINE_COLOR }} />
                <p className="text-[10px] text-green-700 uppercase tracking-widest">online</p>
                <span className="text-[10px] text-green-900">{online.length}</span>
              </div>
              {online.length === 0 && <p className="text-[10px] text-green-950 px-2">// nobody&apos;s online right now</p>}
              {online.map(m => <MemberRow key={m.id} member={m} online />)}
            </div>

            {offline.length > 0 && (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 px-2 pb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: OFFLINE_COLOR }} />
                  <p className="text-[10px] text-green-950 uppercase tracking-widest">offline</p>
                  <span className="text-[10px] text-green-950">{offline.length}</span>
                </div>
                {offline.map(m => <MemberRow key={m.id} member={m} online={false} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
