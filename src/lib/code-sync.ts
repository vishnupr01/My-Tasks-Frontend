import * as Y from 'yjs';
import { getSocket } from './socket';

export type SyncStatus = 'connecting' | 'synced' | 'offline' | 'error';

/**
 * Someone else's caret. `anchor`/`head` are encoded Yjs *relative*
 * positions -- they identify a character rather than an offset, so the
 * caret stays in the right place as text is inserted above it. They're
 * resolved against the local document by the cursor renderer.
 */
export interface RemoteCursor {
  socketId: string;
  userId: string;
  username: string;
  anchor: Uint8Array | null;
  head: Uint8Array | null;
}

export interface CodeSyncHandle {
  doc: Y.Doc;
  text: Y.Text;
  /** Publish where this user's caret is. Safe to call often; it's throttled. */
  sendCursor: (anchor: Uint8Array | null, head: Uint8Array | null) => void;
  /** Subscribe to everyone else's carets. Returns an unsubscribe function. */
  onCursors: (listener: (cursors: RemoteCursor[]) => void) => () => void;
  destroy: () => void;
}

// A caret can move on every keystroke and every mouse drag frame. Sending
// each one would flood the socket for no visual gain -- ~20 updates a
// second already looks continuous.
const CURSOR_THROTTLE_MS = 50;

// Marks updates that arrived from the server. Yjs passes this "origin"
// value to update listeners, which is how we avoid an infinite loop:
// applying a remote update fires our own update handler, and without a way
// to recognise it we'd send the change straight back to the server.
const REMOTE_ORIGIN = Symbol('remote');

// Socket.IO gives us binary back as ArrayBuffer (or occasionally a plain
// array after a JSON fallback); Yjs only accepts Uint8Array.
function toUint8Array(value: unknown): Uint8Array | null {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  return null;
}

/**
 * Keeps one Y.Doc in sync with everyone else editing the same document,
 * over the app's existing authenticated socket.
 *
 * The exchange has two directions that never cross:
 *   local edit  -> doc 'update' event -> emit 'code:update'
 *   remote edit -> on 'code:update'   -> Y.applyUpdate(..., REMOTE_ORIGIN)
 *
 * What makes this safe without any locking or ordering is the CRDT itself:
 * every update is a small delta that can be applied in any order, more
 * than once, and still lands every participant on the same text. There is
 * no "who wins" question to answer, which is exactly what the Phase 0
 * whole-file save got wrong.
 */
export function createCodeSync(
  channelId: string,
  onStatus: (status: SyncStatus) => void,
  path = 'main',
): CodeSyncHandle {
  const socket = getSocket();
  const doc = new Y.Doc();
  const text = doc.getText('content');

  const handleLocalUpdate = (update: Uint8Array, origin: unknown) => {
    // Came from the server -- everyone already has it.
    if (origin === REMOTE_ORIGIN) return;
    socket.emit('code:update', { channelId, path, update });
  };

  const handleRemoteUpdate = (payload: { channelId: string; path: string; update: unknown }) => {
    if (payload.channelId !== channelId || payload.path !== path) return;
    const update = toUint8Array(payload.update);
    if (update) Y.applyUpdate(doc, update, REMOTE_ORIGIN);
  };

  /**
   * The handshake, also re-run on every reconnect.
   *
   * We send a *state vector*: a few bytes summarising which updates we
   * already hold, not the document itself. The server replies with only
   * what we're missing, plus its own state vector so we can work out what
   * IT is missing -- edits we made while disconnected -- and send those.
   *
   * That two-way diff is why closing your laptop mid-edit and reopening it
   * merges cleanly instead of one side overwriting the other.
   */
  const handshake = () => {
    onStatus('connecting');
    socket.emit(
      'code:join',
      { channelId, path, stateVector: Y.encodeStateVector(doc) },
      (response: { update?: unknown; stateVector?: unknown; cursors?: RemoteCursor[]; error?: string } | undefined) => {
        if (!response || response.error) {
          onStatus('error');
          return;
        }

        const missingHere = toUint8Array(response.update);
        if (missingHere && missingHere.length > 0) {
          Y.applyUpdate(doc, missingHere, REMOTE_ORIGIN);
        }

        const serverVector = toUint8Array(response.stateVector);
        if (serverVector) {
          const missingThere = Y.encodeStateAsUpdate(doc, serverVector);
          // Empty for a fresh tab; non-empty when we edited while offline.
          if (missingThere.length > 0) {
            socket.emit('code:update', { channelId, path, update: missingThere });
          }
        }

        // Who was already editing before we arrived. Rebuilt from scratch
        // rather than merged, since after a reconnect our old list may
        // name people who have since left.
        remoteCursors.clear();
        (response.cursors ?? []).forEach(cursor => {
          remoteCursors.set(cursor.socketId, {
            ...cursor,
            anchor: toUint8Array(cursor.anchor),
            head: toUint8Array(cursor.head),
          });
        });
        notifyCursorListeners();

        onStatus('synced');
      },
    );
  };

  const handleDisconnect = () => onStatus('offline');

  // ── Cursors ─────────────────────────────────────────────────────
  // Kept entirely separate from the document: carets are ephemeral, they
  // change far more often than text, and they must never end up in the
  // document's saved history.

  const remoteCursors = new Map<string, RemoteCursor>();
  const cursorListeners = new Set<(cursors: RemoteCursor[]) => void>();

  const notifyCursorListeners = () => {
    const list = [...remoteCursors.values()];
    cursorListeners.forEach(listener => listener(list));
  };

  const handleRemoteCursor = (payload: RemoteCursor & { channelId: string; path: string }) => {
    if (payload.channelId !== channelId || payload.path !== path) return;
    remoteCursors.set(payload.socketId, {
      socketId: payload.socketId,
      userId: payload.userId,
      username: payload.username,
      anchor: toUint8Array(payload.anchor),
      head: toUint8Array(payload.head),
    });
    notifyCursorListeners();
  };

  const handleCursorLeft = (payload: { channelId: string; path: string; socketId: string }) => {
    if (payload.channelId !== channelId || payload.path !== path) return;
    if (remoteCursors.delete(payload.socketId)) notifyCursorListeners();
  };

  // Trailing throttle: the first move goes out immediately (so the caret
  // feels responsive to others), and the last position of a burst is
  // always sent too -- otherwise a caret could come to rest somewhere and
  // everyone else would keep seeing it at its second-to-last spot.
  let cursorTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingCursor: { anchor: Uint8Array | null; head: Uint8Array | null } | null = null;

  const flushCursor = () => {
    if (!pendingCursor) return;
    socket.emit('code:cursor', { channelId, path, ...pendingCursor });
    pendingCursor = null;
  };

  const sendCursor = (anchor: Uint8Array | null, head: Uint8Array | null) => {
    pendingCursor = { anchor, head };
    if (cursorTimer) return;
    flushCursor();
    cursorTimer = setTimeout(() => {
      cursorTimer = null;
      flushCursor();
    }, CURSOR_THROTTLE_MS);
  };

  doc.on('update', handleLocalUpdate);
  socket.on('code:update', handleRemoteUpdate);
  socket.on('code:cursor', handleRemoteCursor);
  socket.on('code:cursor-left', handleCursorLeft);
  socket.on('connect', handshake);
  socket.on('disconnect', handleDisconnect);

  if (socket.connected) handshake();

  return {
    doc,
    text,
    sendCursor,
    onCursors: listener => {
      cursorListeners.add(listener);
      listener([...remoteCursors.values()]); // current state, don't wait for the next move
      return () => cursorListeners.delete(listener);
    },
    destroy: () => {
      if (cursorTimer) clearTimeout(cursorTimer);
      socket.emit('code:leave', { channelId, path });
      socket.off('code:update', handleRemoteUpdate);
      socket.off('code:cursor', handleRemoteCursor);
      socket.off('code:cursor-left', handleCursorLeft);
      socket.off('connect', handshake);
      socket.off('disconnect', handleDisconnect);
      doc.off('update', handleLocalUpdate);
      cursorListeners.clear();
      doc.destroy();
    },
  };
}
