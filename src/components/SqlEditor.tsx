import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { basicSetup } from 'codemirror';
import { useEffect, useRef } from 'react';

export type SqlSchema = Record<string, string[]>;

/**
 * Suggests column names anywhere, without needing a "table." prefix
 * (the built-in SQL completion only offers columns after a table name).
 */
function columnCompletion(schema: SqlSchema) {
  const tablesByColumn = new Map<string, string[]>();
  for (const [table, columns] of Object.entries(schema)) {
    for (const column of columns) {
      tablesByColumn.set(column, [...(tablesByColumn.get(column) ?? []), table]);
    }
  }
  const options = [...tablesByColumn].map(([label, tables]) => ({
    label,
    type: 'property',
    detail: tables.join(', '),
  }));
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\w+/);
    if (!word || context.matchBefore(/\.\w*/)) return null;
    return { from: word.from, options, validFor: /^\w*$/ };
  };
}

function sqlSupport(schema: SqlSchema) {
  const support = sql({ dialect: PostgreSQL, schema, upperCaseKeywords: true });
  return [support, support.language.data.of({ autocomplete: columnCompletion(schema) })];
}

// Colors come from CSS variables, so one theme serves light and dark mode.
const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syn-keyword)', fontWeight: '600' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--syn-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--syn-number)' },
  { tag: [tags.lineComment, tags.blockComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.standard(tags.name)], color: 'var(--syn-function)' },
  { tag: tags.typeName, color: 'var(--syn-function)' },
  { tag: [tags.operator, tags.punctuation], color: 'var(--muted)' },
]);

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13.5px', color: 'var(--ink)', backgroundColor: 'var(--panel)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': { caretColor: 'var(--accent)', padding: '10px 0' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-gutters': {
    backgroundColor: 'var(--panel)',
    color: 'var(--faint)',
    border: 'none',
    borderRight: '1px solid var(--rule)',
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ink)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--accent-wash)',
  },
  '.cm-selectionMatch': { backgroundColor: 'var(--wash)' },
  '&.cm-focused .cm-matchingBracket': { backgroundColor: 'var(--wash)', outline: '1px solid var(--rule)' },
  '.cm-placeholder': { color: 'var(--faint)' },
  '.cm-foldPlaceholder': { backgroundColor: 'var(--wash)', border: 'none', color: 'var(--muted)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--panel)',
    color: 'var(--ink)',
    border: '1px solid var(--ink)',
    borderRadius: '0',
    fontFamily: 'var(--font-mono)',
    fontSize: '12.5px',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--ink)',
    color: 'var(--paper)',
  },
  '.cm-completionDetail': { color: 'var(--faint)', fontStyle: 'normal' },
  '.cm-panels': { backgroundColor: 'var(--wash)', color: 'var(--ink)' },
});

/**
 * CodeMirror SQL editor. `schema` (table name -> column names) drives
 * autocomplete and is swapped in place when tables change.
 */
export function SqlEditor({
  value,
  onChange,
  onRun,
  schema,
}: {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  schema: SqlSchema;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const language = useRef(new Compartment());
  const callbacks = useRef({ onChange, onRun });
  callbacks.current = { onChange, onRun };

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          Prec.highest(
            keymap.of([
              {
                key: 'Mod-Enter',
                run: () => {
                  callbacks.current.onRun();
                  return true;
                },
              },
            ]),
          ),
          basicSetup,
          language.current.of(sqlSupport(schema)),
          syntaxHighlighting(highlight),
          placeholder('Write SQL here, then press Ctrl/Cmd + Enter'),
          theme,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The editor is created once; later changes are synced by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: language.current.reconfigure(sqlSupport(schema)) });
  }, [schema]);

  return <div ref={host} data-testid="sql-editor" className="h-full overflow-hidden" />;
}
