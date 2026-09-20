'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { OnMount } from '@monaco-editor/react';
import { channels as channelsApi } from '@/lib/api';
import { createCodeSync, type CodeSyncHandle, type SyncStatus } from '@/lib/code-sync';
import { bindMonacoToYText } from '@/lib/monaco-yjs-binding';
import { createRemoteCursorRenderer, encodeLocalCursor } from '@/lib/remote-cursors';
import type { CodeDocument } from '@/types';

// Monaco touches `window`/`document` as it loads, so it can't be server
// rendered -- hence dynamic() with ssr:false. It also pulls its own assets
// from a CDN at runtime (jsdelivr, the wrapper's default), which keeps it
// out of our bundle but means the editor needs internet the first time a
// browser loads it. Self-hosting those assets is a later concern.
const MonacoEditorComponent = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="p-4 text-xs text-green-800">loading editor...</div>,
});

// Monaco's own language ids -- passed through verbatim, so these must
// match what Monaco expects rather than our own naming.
const LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go',
  'rust', 'php', 'ruby', 'sql', 'html', 'css', 'json', 'markdown', 'shell',
];

const STATUS_LABEL: Record<SyncStatus, string> = {
  connecting: 'connecting...',
  synced: 'live',
  offline: 'offline -- edits will sync on reconnect',
  error: 'sync failed',
};

export default function CodeEditorPanel({ channelId }: { channelId: string }) {
  const [doc, setDoc] = useState<CodeDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  // Monaco is effectively unusable on a touch screen (no real caret
  // control, its own scrolling fights the page). Below lg we show live
  // read-only text instead of a broken editor -- chat still works there.
  const [canEdit, setCanEdit] = useState(false);
  const [readOnlyText, setReadOnlyText] = useState('');

  const syncRef = useRef<CodeSyncHandle | null>(null);
  const unbindRef = useRef<(() => void) | null>(null);
  // Everything the editor sets up on mount, torn down together.
  const editorCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const sync = () => setCanEdit(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // Metadata only (language, path). The *text* no longer comes from here
  // -- it arrives through the CRDT handshake below, which is the single
  // source of truth now that several people can be typing at once.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    channelsApi.getCode(channelId)
      .then(loaded => {
        if (cancelled) return;
        setDoc(loaded);
        setLanguage(loaded.language);
      })
      .catch(err => { if (!cancelled) setLoadError(err?.message || 'Could not load this document'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [channelId]);

  // One shared document per channel, alive for as long as this panel is.
  // Deliberately separate from the editor: the CRDT is the document, and
  // Monaco is just one possible view onto it -- which is what lets the
  // small-screen read-only view below stay live with no extra plumbing.
  useEffect(() => {
    const handle = createCodeSync(channelId, setSyncStatus);
    syncRef.current = handle;

    const renderText = () => setReadOnlyText(handle.text.toString());
    handle.text.observe(renderText);
    renderText();

    return () => {
      handle.text.unobserve(renderText);
      editorCleanupRef.current?.();
      editorCleanupRef.current = null;
      unbindRef.current?.();
      unbindRef.current = null;
      handle.destroy();
      syncRef.current = null;
    };
  }, [channelId]);

  // Monaco is ready: attach it to the CRDT. Everything typed from here on
  // flows model -> Y.Text -> socket, and back the other way.
  const handleEditorMount = useCallback<OnMount>((editor, monaco) => {
    const handle = syncRef.current;
    const model = editor.getModel();
    if (!handle || !model) return;

    unbindRef.current?.();
    unbindRef.current = bindMonacoToYText(monaco, model, handle.text);

    const cursors = createRemoteCursorRenderer(monaco, editor, handle.doc, handle.text);

    // Publish this user's caret. Both events matter: selection covers
    // typing/clicking/dragging, and a focus change is worth reporting so
    // a caret doesn't look active in a window nobody is using.
    const publishCursor = () => {
      const { anchor, head } = encodeLocalCursor(editor, handle.text);
      handle.sendCursor(anchor, head);
    };
    const selectionListener = editor.onDidChangeCursorSelection(publishCursor);
    const focusListener = editor.onDidFocusEditorText(publishCursor);

    // Re-resolve everyone's positions when someone edits: a caret three
    // lines below an insertion has moved down, even though its owner
    // never touched anything.
    const onTextChange = () => cursors.render();
    handle.text.observe(onTextChange);

    const unsubscribeCursors = handle.onCursors(list => cursors.render(list));
    publishCursor();

    editorCleanupRef.current = () => {
      selectionListener.dispose();
      focusListener.dispose();
      handle.text.unobserve(onTextChange);
      unsubscribeCursors();
      cursors.destroy();
    };
  }, []);

  // Language is metadata, not document content, so it still travels over
  // REST. Note this doesn't broadcast: another person sees the change
  // after a reload. Worth fixing alongside the other live-presence work.
  const handleLanguageChange = (next: string) => {
    setLanguage(next);
    channelsApi.saveCode(channelId, { language: next }).catch(() => {});
  };

  const statusColor = syncStatus === 'synced' ? 'text-green-700'
    : syncStatus === 'error' ? 'text-red-500'
    : 'text-yellow-600';

  return (
    <div className="flex flex-col min-h-0 h-full bg-black">
      <div className="shrink-0 flex items-center gap-3 px-3 py-2 border-b border-green-900/40">
        <span className="text-[10px] text-green-800 uppercase tracking-widest shrink-0">
          {doc?.path ?? 'main'}
        </span>

        <select
          value={language}
          onChange={e => handleLanguageChange(e.target.value)}
          disabled={loading || !!loadError}
          className="bg-black border border-green-900 rounded-sm text-green-400 text-xs font-mono px-2 py-1 focus:outline-none focus:border-green-500 disabled:opacity-40"
        >
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <span className={`text-[10px] ml-auto flex items-center gap-1.5 ${statusColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'synced' ? 'bg-green-600' : syncStatus === 'error' ? 'bg-red-500' : 'bg-yellow-600 animate-pulse'}`} />
          {STATUS_LABEL[syncStatus]}
        </span>
      </div>

      <div className="flex-1 min-h-0">
        {loading && <div className="p-4 text-xs text-green-800">loading document...</div>}

        {!loading && loadError && (
          <div className="p-4 text-xs text-red-500">[ERR] {loadError}</div>
        )}

        {!loading && !loadError && (
          canEdit ? (
            <MonacoEditorComponent
              height="100%"
              theme="vs-dark"
              language={language}
              // No value/defaultValue on purpose: the binding owns the
              // model's contents. Handing Monaco text here would fight it.
              onMount={handleEditorMount}
              options={{
                fontSize: 13,
                fontFamily: 'var(--font-mono, monospace)',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true, // re-measures when the chat pane resizes it
                tabSize: 2,
                padding: { top: 12 },
              }}
            />
          ) : (
            <div className="h-full overflow-auto scrollbar-thin">
              <p className="px-3 py-2 text-[10px] text-green-900 border-b border-green-900/30">
                // read-only on small screens -- open on a desktop to edit
              </p>
              <pre className="p-3 text-xs text-green-300 whitespace-pre-wrap break-words">
                {readOnlyText || '// empty'}
              </pre>
            </div>
          )
        )}
      </div>
    </div>
  );
}
