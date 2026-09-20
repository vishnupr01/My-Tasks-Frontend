import { io, type Socket } from 'socket.io-client';
import { getToken } from './auth';
import { getApiBaseUrl } from './api-url';

let socket: Socket | null = null;

// Singleton connection shared across every chat page mounted in this tab --
// pages join/leave the specific rooms they need rather than each opening
// their own socket.
export function getSocket(): Socket {
  if (socket) return socket;

  // Same host the page came from -- see api-url.ts.
  socket = io(getApiBaseUrl(), {
    auth: { token: getToken() },
    autoConnect: true,
    reconnection: true,
  });

  return socket;
}
