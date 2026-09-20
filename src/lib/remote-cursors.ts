import * as Y from 'yjs';
import type { Monaco, OnMount } from '@monaco-editor/react';
import { userColor } from './userColor';
import type { RemoteCursor } from './code-sync';

type CodeEditor = Parameters<OnMount>[0];

// One <style> element for the whole app, rewritten as people come and go.
// Monaco decorations can only reference CSS *class names* -- there's no
// way to pass an inline color -- so a per-user rule has to exist in the
// document for each collaborator's color and name.
const STYLE_ELEMENT_ID = 'remote-cursor-styles';

/** Socket ids are URL-safe base64, but a class mustn't start with a digit. */
function classKey(socketId: string): string {
  return `rc-${socketId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** Usernames end up inside a CSS string literal, so quotes must not escape it. */
function cssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Draws other people's carets, selections and name tags inside Monaco.
 *
 * The interesting part is position resolution. Cursors travel as Yjs
 * *relative* positions: "just after the character with id (client 7,
 * clock 42)" rather than "offset 137". Offsets go stale the instant
 * anyone types above them -- a relative position doesn't, because the
 * character it names keeps its identity no matter how the text shifts.
 *
 * So every render resolves relative -> absolute against the *current*
 * document, and render() is called again whenever the text changes, not
 * only when someone moves.
 */
export function createRemoteCursorRenderer(
  monaco: Monaco,
  editor: CodeEditor,
  doc: Y.Doc,
  ytext: Y.Text,
) {
  const collection = editor.createDecorationsCollection();
  let latest: RemoteCursor[] = [];
  let styleSignature = '';

  const styleEl = document.getElementById(STYLE_ELEMENT_ID) ?? (() => {
    const el = document.createElement('style');
    el.id = STYLE_ELEMENT_ID;
    document.head.appendChild(el);
    return el;
  })();

  const resolveIndex = (encoded: Uint8Array | null): number | null => {
    if (!encoded || encoded.length === 0) return null;
    try {
      const relative = Y.decodeRelativePosition(encoded);
      const absolute = Y.createAbsolutePositionFromRelativePosition(relative, doc);
      // A null result means the character it pointed at was deleted --
      // the sender's own next update will replace this position anyway.
      if (!absolute || absolute.type !== ytext) return null;
      return absolute.index;
    } catch {
      return null;
    }
  };

  const writeStyles = (cursors: RemoteCursor[]) => {
    // Rewriting identical CSS on every keystroke would make the browser
    // re-evaluate styles for nothing, so only write when it changes.
    const signature = cursors.map(c => `${c.socketId}:${c.username}`).join('|');
    if (signature === styleSignature) return;
    styleSignature = signature;

    styleEl.textContent = cursors.map(cursor => {
      const key = classKey(cursor.socketId);
      const color = userColor(cursor.userId); // same palette as chat usernames
      return `
        .${key}-selection { background-color: ${color}33; }
        .${key}-caret {
          border-left: 2px solid ${color};
          position: relative;
          margin-left: -1px;
          pointer-events: none;
        }
        .${key}-caret::after {
          content: "${cssString(cursor.username)}";
          position: absolute;
          top: -1.15em;
          left: -2px;
          padding: 0 4px;
          font-size: 10px;
          line-height: 1.15em;
          white-space: nowrap;
          border-radius: 2px 2px 2px 0;
          background-color: ${color};
          color: #000;
          font-family: inherit;
          z-index: 20;
        }`;
    }).join('\n');
  };

  const render = (cursors?: RemoteCursor[]) => {
    if (cursors) latest = cursors;
    const model = editor.getModel();
    if (!model) return;

    writeStyles(latest);

    // collection.set() takes a readonly array, so build a mutable one of
    // the same element type and hand it over at the end.
    const decorations: Parameters<typeof collection.set>[0][number][] = [];

    for (const cursor of latest) {
      const key = classKey(cursor.socketId);
      const headIndex = resolveIndex(cursor.head);
      if (headIndex === null) continue;
      const anchorIndex = resolveIndex(cursor.anchor) ?? headIndex;

      // Highlight the selected span, if they have one selected.
      if (anchorIndex !== headIndex) {
        const from = model.getPositionAt(Math.min(anchorIndex, headIndex));
        const to = model.getPositionAt(Math.max(anchorIndex, headIndex));
        decorations.push({
          range: new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column),
          options: { className: `${key}-selection` },
        });
      }

      // The caret itself: an empty range, drawn by attaching a styled
      // element before that position (an empty range has no width of its
      // own, so a plain className would render nothing).
      const head = model.getPositionAt(headIndex);
      decorations.push({
        range: new monaco.Range(head.lineNumber, head.column, head.lineNumber, head.column),
        options: {
          beforeContentClassName: `${key}-caret`,
          // Don't let the caret absorb text typed right at its position.
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    collection.set(decorations);
  };

  return {
    render,
    destroy: () => {
      collection.clear();
      styleEl.textContent = '';
      styleSignature = '';
    },
  };
}

/**
 * Turns the local caret into the relative positions other clients need.
 * Returns nulls when there's no selection to report.
 */
export function encodeLocalCursor(editor: CodeEditor, ytext: Y.Text) {
  const model = editor.getModel();
  const selection = editor.getSelection();
  if (!model || !selection) return { anchor: null, head: null };

  const anchorIndex = model.getOffsetAt(selection.getStartPosition());
  const headIndex = model.getOffsetAt(selection.getEndPosition());

  return {
    anchor: Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(ytext, anchorIndex)),
    head: Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(ytext, headIndex)),
  };
}
