/**
 * The contract between the browser and the /api/ai Worker.
 *
 * Privacy rule: the only facts about a visitor's data that may leave the
 * browser are table names, column names and column types. Rows, cell values,
 * file names and file contents are never part of a request. The browser
 * builds requests with `buildAiRequest`, and the Worker independently
 * re-validates them with `parseAiRequest`, so neither side trusts the other.
 */

export type AiTask = 'generate' | 'explain' | 'fix';

export interface AiColumn {
  name: string;
  type: string;
}

export interface AiTable {
  name: string;
  columns: AiColumn[];
}

export interface AiRequest {
  task: AiTask;
  /** Table names, column names and column types. Nothing else about the data. */
  schema: AiTable[];
  /** generate: the visitor's question in plain English. */
  question?: string;
  /** explain / fix: the SQL the visitor wrote. */
  sql?: string;
  /** fix: the database's error message, with literal values removed. */
  error?: string;
}

export type AiErrorCode = 'bad_request' | 'rate_limited' | 'unavailable';

export type AiResponse =
  | { ok: true; text: string }
  | { ok: false; error: AiErrorCode; message: string };

export const LIMITS = {
  tables: 30,
  columnsPerTable: 150,
  name: 128,
  question: 500,
  sql: 6000,
  error: 1000,
  bodyBytes: 200_000,
} as const;

const TASKS: AiTask[] = ['generate', 'explain', 'fix'];

/** The minimum a caller needs to know about a table; extra fields are ignored. */
interface TableLike {
  name: string;
  columns: { name: string; type: string }[];
}

/**
 * Removes literal values from a database error message. DuckDB quotes data
 * values with single quotes ("Could not convert string 'Jane Doe' to INT32")
 * and identifiers with double quotes, so single-quoted text and long numbers
 * are masked while table and column names are kept.
 */
export function redactError(message: string): string {
  return message
    .replace(/'(?:[^'\n]|'')*'/g, "'?'")
    .replace(/\d[\d.,:/-]{3,}/g, '?')
    .slice(0, LIMITS.error);
}

/**
 * Builds the request body sent to the AI. Copies only names and types out of
 * the table list, field by field, so nothing else can ride along.
 */
export function buildAiRequest(
  task: AiTask,
  tables: TableLike[],
  input: { question?: string; sql?: string; error?: string },
): AiRequest {
  const schema = tables.slice(0, LIMITS.tables).map((table) => ({
    name: table.name.slice(0, LIMITS.name),
    columns: table.columns.slice(0, LIMITS.columnsPerTable).map((column) => ({
      name: column.name.slice(0, LIMITS.name),
      type: column.type.slice(0, LIMITS.name),
    })),
  }));
  const request: AiRequest = { task, schema };
  if (task === 'generate') request.question = (input.question ?? '').trim().slice(0, LIMITS.question);
  if (task !== 'generate') request.sql = (input.sql ?? '').trim().slice(0, LIMITS.sql);
  if (task === 'fix') request.error = redactError(input.error ?? '');
  return request;
}

export class BadRequest extends Error {}

function text(value: unknown, field: string, max: number, required: boolean): string | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) throw new BadRequest(`Missing ${field}.`);
    return undefined;
  }
  if (typeof value !== 'string') throw new BadRequest(`${field} must be text.`);
  if (value.length > max) throw new BadRequest(`${field} is too long.`);
  return value;
}

/**
 * Validates an incoming request body on the server and rebuilds it from
 * known fields only. Unknown fields are dropped rather than passed along.
 */
export function parseAiRequest(body: unknown): AiRequest {
  if (typeof body !== 'object' || body === null) throw new BadRequest('Expected a JSON object.');
  const raw = body as Record<string, unknown>;
  if (!TASKS.includes(raw.task as AiTask)) throw new BadRequest('Unknown task.');
  const task = raw.task as AiTask;

  if (!Array.isArray(raw.schema)) throw new BadRequest('Missing schema.');
  if (raw.schema.length > LIMITS.tables) throw new BadRequest('Too many tables.');
  const schema = raw.schema.map((entry: unknown): AiTable => {
    const table = entry as Record<string, unknown>;
    if (typeof table !== 'object' || table === null || !Array.isArray(table.columns)) {
      throw new BadRequest('Malformed table.');
    }
    if (table.columns.length > LIMITS.columnsPerTable) throw new BadRequest('Too many columns.');
    return {
      name: text(table.name, 'table name', LIMITS.name, true)!,
      columns: table.columns.map((item: unknown) => {
        const column = (item ?? {}) as Record<string, unknown>;
        return {
          name: text(column.name, 'column name', LIMITS.name, true)!,
          type: text(column.type, 'column type', LIMITS.name, true)!,
        };
      }),
    };
  });

  const request: AiRequest = { task, schema };
  if (task === 'generate') {
    request.question = text(raw.question, 'question', LIMITS.question, true);
  } else {
    request.sql = text(raw.sql, 'sql', LIMITS.sql, true);
  }
  if (task === 'fix') request.error = text(raw.error, 'error', LIMITS.error, true);
  return request;
}

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

function describeSchema(schema: AiTable[]): string {
  if (schema.length === 0) return '(no tables loaded)';
  return schema
    .map((t) => `${t.name}(${t.columns.map((c) => `${c.name} ${c.type}`).join(', ')})`)
    .join('\n');
}

const SQL_RULES = `Rules:
- Reply with exactly one DuckDB SQL query and nothing else: no explanation, no markdown.
- It must be a single read-only SELECT statement (WITH ... SELECT is fine). Never modify data.
- Use only the tables and columns listed. Put double quotes around names that contain spaces or symbols.
- Prefer clear column aliases, and add ORDER BY and LIMIT when the question asks for a "top" or "most".`;

/** Turns a validated request into the prompt for the model. */
export function buildMessages(request: AiRequest): ChatMessage[] {
  const tables = `Tables:\n${describeSchema(request.schema)}`;
  switch (request.task) {
    case 'generate':
      return [
        { role: 'system', content: `You translate questions into DuckDB SQL.\n${SQL_RULES}` },
        { role: 'user', content: `${tables}\n\nQuestion: ${request.question}` },
      ];
    case 'fix':
      return [
        { role: 'system', content: `You fix broken DuckDB SQL queries.\n${SQL_RULES}` },
        {
          role: 'user',
          content: `${tables}\n\nQuery:\n${request.sql}\n\nError:\n${request.error}\n\nReply with the corrected query.`,
        },
      ];
    case 'explain':
      return [
        {
          role: 'system',
          content:
            'You explain DuckDB SQL queries to beginners. Reply in plain English with at most four short sentences. No markdown, no preamble, and do not repeat the query.',
        },
        { role: 'user', content: `${tables}\n\nQuery:\n${request.sql}` },
      ];
  }
}

/** Pulls the SQL out of a model reply that may be wrapped in a markdown code fence. */
export function extractSql(reply: string): string {
  const fenced = /```(?:sql|duckdb)?\s*\n?([\s\S]*?)```/i.exec(reply);
  return (fenced ? fenced[1] : reply).trim();
}
