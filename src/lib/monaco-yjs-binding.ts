import type * as Y from 'yjs';
import type { Monaco, OnMount } from '@monaco-editor/react';

// Derived from the wrapper's own exported types rather than importing
// 'monaco-editor' directly -- that package is only present transitively
// here (Monaco itself is fetched from a CDN at runtime), so importing it
// by name would break the build if the dependency tree ever flattens
// differently.
type CodeEditor = Parameters<OnMount>[0];
export type TextModel = NonNullable<ReturnType<CodeEditor['getModel']>>;

/**
 * Connects a Monaco model to a Y.Text so the two always hold the same
 * characters.
 *
 * Written by hand rather than pulling in y-monaco for two reasons: that
 * package imports its own copy of monaco-editor (we load Monaco from a
 * CDN, and two copies means its Range class isn't our Range class), and
 * this is the piece most worth being able to read.
 *
 * The whole job is translating between two ways of describing an edit:
 *   Monaco thinks in ranges     -- "replace line 3 col 5 to line 3 col 9"
 *   Y.Text thinks in offsets    -- "delete 4 chars at index 42, insert ..."
 *
 * Both count positions in UTF-16 code units, so the numbers line up
 * directly -- with one catch, handled below: line endings.
 */
export function bindMonacoToYText(
  monaco: Monaco,
  model: TextModel,
  ytext: Y.Text,
): () => void {

  // A mutex across BOTH directions, not just one.
  //
  // Each side of this binding reacts to the other, and each write fires
  // the other's listener *synchronously*:
  //
  //   you type -> Monaco change -> ytext.insert() -> observer fires
  //   remote   -> Y.applyUpdate -> observer -> model.applyEdits() -> change fires
  //
  // Guarding only the remote direction (the first version of this file)
  // meant your own keystroke came straight back through the observer and
  // got written into Monaco a second time, at an index computed against
  // text that had already changed -- which showed up as characters landing
  // in the wrong order as you typed.
  //
  // Whoever is mid-application holds the lock; the other side sees it held
  // and skips, because that side already has the change. A plain boolean
  // is enough: both handlers are fully synchronous, so there's no await
  // during which a second holder could sneak in.
  let applying = false;

  // Seed Monaco with whatever the document already contains.
  applying = true;
  model.setValue(ytext.toString());
  // Must come *after* setValue, which re-derives the model's line ending
  // from the text it was handed (an empty document on Windows lands on
  // CRLF). Order matters: with CRLF, pressing Enter puts "\r\n" in the
  // model, and Monaco normalizes newlines written by other people to match
  // -- so Monaco would count two characters where Y.Text counts one, and
  // every offset past the first line break would drift. Forcing LF here
  // keeps both sides counting identically.
  model.setEOL(monaco.editor.EndOfLineSequence.LF);
  applying = false;

  // ── Remote -> Monaco ────────────────────────────────────────────
  //
  // A Yjs delta is a sequence of instructions walked left to right:
  // retain (skip N characters), insert (add text), delete (remove N).
  // Each one is applied to the model immediately rather than collected
  // into a batch, because `index` advances through the document *as it
  // changes* -- an insert shifts everything after it, and the next
  // instruction's index already assumes that shift happened.
  const observer = (event: Y.YTextEvent) => {
    // Our own edit, already in Monaco -- applying it again is the bug
    // described above.
    if (applying) return;
    applying = true;
    try {
      let index = 0;
      for (const op of event.delta) {
        if (op.retain !== undefined) {
          index += op.retain;
        } else if (typeof op.insert === 'string') {
          const pos = model.getPositionAt(index);
          model.applyEdits([{
            range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
            text: op.insert,
          }]);
          index += op.insert.length;
        } else if (op.delete !== undefined) {
          const from = model.getPositionAt(index);
          const to = model.getPositionAt(index + op.delete);
          model.applyEdits([{
            range: new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column),
            text: '',
          }]);
        }
      }
    } finally {
      applying = false;
    }
  };
  ytext.observe(observer);

  // ── Monaco -> Y.Text ────────────────────────────────────────────
  //
  // Monaco can report several changes from one action (multi-cursor
  // typing, find-and-replace). Their offsets all describe the document
  // *before* the action, so applying them front to back would invalidate
  // every offset after the first. Sorting highest-offset-first means each
  // edit only touches text after the ones still to come.
  //
  // The transact() wrapper makes the whole batch one atomic update: one
  // network message, and one undo step, instead of N.
  const changeListener = model.onDidChangeContent(event => {
    // A remote update being written into Monaco right now -- it's already
    // in the CRDT, so sending it back would be an echo.
    if (applying) return;

    // Held for the whole transaction so the observer (which fires
    // synchronously on ytext.insert/delete below) knows Monaco already
    // has this text and skips re-applying it.
    applying = true;
    try {
      ytext.doc?.transact(() => {
        event.changes
          .slice()
          .sort((a, b) => b.rangeOffset - a.rangeOffset)
          .forEach(change => {
            // A replacement is a delete plus an insert; either half can be
            // empty (pure insert, or pure delete) and Yjs no-ops on those.
            if (change.rangeLength > 0) ytext.delete(change.rangeOffset, change.rangeLength);
            if (change.text.length > 0) ytext.insert(change.rangeOffset, change.text);
          });
      });
    } finally {
      applying = false;
    }
  });

  return () => {
    ytext.unobserve(observer);
    changeListener.dispose();
  };
}
