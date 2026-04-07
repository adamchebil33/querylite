export interface SqlError {
  /** Short category, e.g. "Syntax error" or "Catalog error". */
  title: string;
  /** What went wrong, in DuckDB's words. */
  message: string;
  /** The offending line with a caret under the problem, when DuckDB provides one. */
  context?: string;
  /** An extra pointer in plain English for common beginner mistakes. */
  hint?: string;
}

const TITLES: Record<string, string> = {
  Parser: 'Syntax error',
  Catalog: 'Unknown table or function',
  Binder: 'Problem with a column or expression',
  Conversion: 'Value could not be converted',
  'Invalid Input': 'Invalid input',
  IO: 'File problem',
  'Out of Memory': 'Out of memory',
};

function hintFor(kind: string, message: string, tableNames: string[]): string | undefined {
  if (kind === 'Catalog' && /Table with name .* does not exist/.test(message)) {
    if (tableNames.length === 0) return 'No tables are loaded yet. Drop a file onto the page first.';
    // DuckDB's own "Did you mean" suggestion is more useful than the full list.
    return message.includes('Did you mean') ? undefined : `Loaded tables: ${tableNames.join(', ')}.`;
  }
  if (kind === 'Parser' && /syntax error at end of input/.test(message)) {
    return 'The query looks unfinished.';
  }
  if (kind === 'Out of Memory') {
    return 'The browser tab ran out of memory. Try selecting fewer columns or adding a LIMIT.';
  }
  return undefined;
}

/**
 * Turns a raw DuckDB error into parts the UI can lay out. DuckDB reports
 * errors either as "Kind Error: message" text or as a JSON object.
 */
export function parseSqlError(raw: string, tableNames: string[] = []): SqlError {
  let kind = '';
  let body = raw.trim();

  if (body.startsWith('{')) {
    try {
      const parsed = JSON.parse(body) as { exception_type?: string; exception_message?: string };
      if (parsed.exception_message) {
        kind = parsed.exception_type ?? '';
        body = parsed.exception_message.trim();
      }
    } catch {
      // Not JSON after all; fall through and show the text as it is.
    }
  } else {
    const match = /^([A-Z][A-Za-z ]*?) Error:\s*/.exec(body);
    if (match) {
      kind = match[1];
      body = body.slice(match[0].length);
    }
  }

  // DuckDB appends "LINE n: <sql>" plus a caret line pointing at the problem.
  let context: string | undefined;
  const lineAt = body.search(/^LINE \d+:/m);
  if (lineAt !== -1) {
    context = body.slice(lineAt).trimEnd();
    body = body.slice(0, lineAt).trim();
  }

  // With no tables loaded, DuckDB's "did you mean" guesses are internal names.
  if (kind === 'Catalog' && tableNames.length === 0) {
    body = body.replace(/\s*Did you mean "[^"]*"\?/, '');
  }

  return {
    title: TITLES[kind] ?? (kind ? `${kind} error` : 'Query failed'),
    message: body,
    context,
    hint: hintFor(kind, body, tableNames),
  };
}
