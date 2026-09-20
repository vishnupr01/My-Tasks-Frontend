'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { getSocket } from './socket';
import { chat as chatApi } from './api';

interface PresenceContextValue {
  isOnline: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceContextValue>({ isOnline: () => false });

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadSnapshot = () => {
      chatApi.listOnline().then(ids => setOnlineUserIds(new Set(ids))).catch(() => {});
    };
    loadSnapshot();

    const socket = getSocket();
    const handleOnline = ({ userId }: { userId: string }) => {
      setOnlineUserIds(prev => new Set(prev).add(userId));
    };
    const handleOffline = ({ userId }: { userId: string }) => {
      setOnlineUserIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };
    // A live diff of online/offline events can't reconstruct "who was
    // already online before this tab connected," and any events missed
    // while disconnected would otherwise leave the set stale -- re-fetch
    // the full snapshot on every (re)connect instead.
    socket.on('presence:online', handleOnline);
    socket.on('presence:offline', handleOffline);
    socket.on('connect', loadSnapshot);
    return () => {
      socket.off('presence:online', handleOnline);
      socket.off('presence:offline', handleOffline);
      socket.off('connect', loadSnapshot);
    };
  }, []);

  const isOnline = useCallback((userId: string) => onlineUserIds.has(userId), [onlineUserIds]);

  return <PresenceContext.Provider value={{ isOnline }}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  return useContext(PresenceContext);
}
