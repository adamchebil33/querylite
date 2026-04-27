import { describe, expect, it } from 'vitest';
import {
  BadRequest,
  buildAiRequest,
  buildMessages,
  extractSql,
  LIMITS,
  parseAiRequest,
  redactError,
} from './ai';

/**
 * A table as the app holds it in memory, deliberately carrying things that
 * must never reach the AI: the file name, the row count, and (to make the
 * test strict) sample rows and a preview that the real app doesn't even keep.
 */
const SECRET_VALUES = ['Jane Doe', 'jane@example.com', '4111-1111-1111-1111', '98765.43', 'Lisbon'];
const tables = [
  {
    name: 'customers',
    source: 'bank-export-jane-doe.csv',
    rowCount: 48211,
    columns: [
      { name: 'full_name', type: 'VARCHAR', sample: 'Jane Doe', min: 'Aaron', max: 'Zoe' },
      { name: 'email', type: 'VARCHAR', sample: 'jane@example.com' },
      { name: 'card_number', type: 'VARCHAR', sample: '4111-1111-1111-1111' },
      { name: 'balance', type: 'DECIMAL(10,2)', sample: 98765.43 },
      { name: 'city', type: 'VARCHAR', sample: 'Lisbon' },
    ],
    preview: [['Jane Doe', 'jane@example.com', '4111-1111-1111-1111', 98765.43, 'Lisbon']],
  },
];

describe('AI request privacy', () => {
  it('sends table names, column names and column types, and nothing else', () => {
    const request = buildAiRequest('generate', tables, { question: 'Who has the highest balance?' });
    expect(request).toEqual({
      task: 'generate',
      question: 'Who has the highest balance?',
      schema: [
        {
          name: 'customers',
          columns: [
            { name: 'full_name', type: 'VARCHAR' },
            { name: 'email', type: 'VARCHAR' },
            { name: 'card_number', type: 'VARCHAR' },
            { name: 'balance', type: 'DECIMAL(10,2)' },
            { name: 'city', type: 'VARCHAR' },
          ],
        },
      ],
    });
  });

  it.each(['generate', 'explain', 'fix'] as const)(
    'never includes data values, file names or row counts (%s)',
    (task) => {
      const request = buildAiRequest(task, tables, {
        question: 'Who has the highest balance?',
        sql: 'SELECT full_name FROM customers ORDER BY balance DESC LIMIT 1',
        error: `Conversion Error: Could not convert string 'Jane Doe' to INT32 at row 48211`,
      });
      const body = JSON.stringify(request);
      for (const secret of [...SECRET_VALUES, 'bank-export', '48211', 'Aaron', 'Zoe']) {
        expect(body).not.toContain(secret);
      }
      // The same holds for the prompt the server builds from it.
      const prompt = JSON.stringify(buildMessages(parseAiRequest(JSON.parse(body))));
      for (const secret of [...SECRET_VALUES, 'bank-export', '48211']) {
        expect(prompt).not.toContain(secret);
      }
    },
  );

  it('masks literal values in error messages but keeps identifiers', () => {
    expect(redactError(`Could not convert string 'Jane Doe' to INT32`)).toBe(
      `Could not convert string '?' to INT32`,
    );
    expect(redactError(`Referenced column "amont" not found. Candidate bindings: "amount"`)).toBe(
      `Referenced column "amont" not found. Candidate bindings: "amount"`,
    );
    expect(redactError(`date field value out of range: '2025-13-45', value 1234567`)).toBe(
      `date field value out of range: '?', value ?`,
    );
    expect(redactError(`it''s 'O''Brien' here`)).not.toContain('Brien');
  });

  it('caps how much schema is sent', () => {
    const wide = [
      {
        name: 't',
        columns: Array.from({ length: 500 }, (_, i) => ({ name: `c${i}`, type: 'INTEGER' })),
      },
    ];
    const request = buildAiRequest('generate', wide, { question: 'q' });
    expect(request.schema[0].columns).toHaveLength(LIMITS.columnsPerTable);
  });
});

describe('parseAiRequest (server-side validation)', () => {
  const valid = buildAiRequest('generate', tables, { question: 'How many customers?' });

  it('accepts what the browser builds', () => {
    expect(parseAiRequest(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
  });

  it('drops unknown fields instead of passing them to the model', () => {
    const tampered = {
      ...valid,
      rows: [['Jane Doe']],
      schema: [{ ...valid.schema[0], preview: ['Jane Doe'], columns: [{ name: 'a', type: 'INT', sample: 'Jane Doe' }] }],
    };
    const parsed = parseAiRequest(tampered);
    expect(JSON.stringify(parsed)).not.toContain('Jane Doe');
    expect(parsed.schema[0].columns).toEqual([{ name: 'a', type: 'INT' }]);
  });

  it('rejects malformed or oversized requests', () => {
    expect(() => parseAiRequest(null)).toThrow(BadRequest);
    expect(() => parseAiRequest({ task: 'delete', schema: [] })).toThrow('Unknown task');
    expect(() => parseAiRequest({ task: 'generate', schema: [] })).toThrow('Missing question');
    expect(() => parseAiRequest({ task: 'explain', schema: [] })).toThrow('Missing sql');
    expect(() => parseAiRequest({ task: 'fix', schema: [], sql: 'SELECT 1' })).toThrow('Missing error');
    expect(() =>
      parseAiRequest({ task: 'generate', schema: [], question: 'x'.repeat(LIMITS.question + 1) }),
    ).toThrow('too long');
    expect(() =>
      parseAiRequest({ task: 'generate', question: 'q', schema: [{ name: 't', columns: [{ name: 5, type: 'INT' }] }] }),
    ).toThrow('must be text');
  });
});

describe('prompts and replies', () => {
  it('describes the schema compactly and demands a single SELECT', () => {
    const [system, user] = buildMessages(
      buildAiRequest('generate', tables, { question: 'Top 5 cities by balance' }),
    );
    expect(system.content).toContain('single read-only SELECT');
    expect(user.content).toContain(
      'customers(full_name VARCHAR, email VARCHAR, card_number VARCHAR, balance DECIMAL(10,2), city VARCHAR)',
    );
    expect(user.content).toContain('Question: Top 5 cities by balance');
  });

  it('extracts SQL from fenced or plain replies', () => {
    expect(extractSql('SELECT 1')).toBe('SELECT 1');
    expect(extractSql('```sql\nSELECT 1;\n```')).toBe('SELECT 1;');
    expect(extractSql('Here you go:\n```\nSELECT 2\n```\nHope it helps')).toBe('SELECT 2');
  });
});
