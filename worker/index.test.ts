import { describe, expect, it, vi } from 'vitest';
import type { AiResponse } from '../shared/ai';
import { handleAi, type Env } from './index';

const schema = [{ name: 'trips', columns: [{ name: 'fare', type: 'DECIMAL(7,2)' }] }];

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://app.example/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://app.example', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function env(run: Env['AI'] extends infer T ? (T extends { run: infer R } ? R : never) : never, allowed = true): Env {
  return {
    AI: { run },
    AI_RATE_LIMIT: { limit: async () => ({ success: allowed }) },
    AI_MODEL: 'test-model',
  };
}

const json = async (response: Response) => (await response.json()) as AiResponse;

describe('POST /api/ai', () => {
  it('returns generated SQL without markdown fences', async () => {
    const run = vi.fn(async () => ({ response: '```sql\nSELECT avg(fare) FROM trips\n```' }));
    const response = await handleAi(post({ task: 'generate', schema, question: 'Average fare?' }), env(run));
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true, text: 'SELECT avg(fare) FROM trips' });

    const [model, input] = run.mock.calls[0] as unknown as [string, { messages: { content: string }[] }];
    expect(model).toBe('test-model');
    expect(input.messages[1].content).toContain('trips(fare DECIMAL(7,2))');
    expect(input.messages[1].content).toContain('Average fare?');
  });

  it('accepts chat-completion shaped replies', async () => {
    const run = async () => ({ choices: [{ message: { content: 'It averages the fare.' } }] });
    const response = await handleAi(post({ task: 'explain', schema, sql: 'SELECT avg(fare) FROM trips' }), env(run));
    expect(await json(response)).toEqual({ ok: true, text: 'It averages the fare.' });
  });

  it('rate-limits per visitor before calling the model', async () => {
    const run = vi.fn(async () => ({ response: 'SELECT 1' }));
    const response = await handleAi(post({ task: 'generate', schema, question: 'q' }), env(run, false));
    expect(response.status).toBe(429);
    expect((await json(response)).ok).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('answers with a friendly error when the model fails or the allowance is used up', async () => {
    const run = async () => {
      throw new Error('4006: you have used up your daily free allocation of 10,000 neurons');
    };
    const response = await handleAi(post({ task: 'generate', schema, question: 'q' }), env(run));
    expect(response.status).toBe(503);
    const body = await json(response);
    expect(body).toMatchObject({ ok: false, error: 'unavailable' });
    expect(JSON.stringify(body)).not.toContain('neurons');
  });

  it('works without AI bindings configured', async () => {
    const response = await handleAi(post({ task: 'generate', schema, question: 'q' }), {});
    expect(response.status).toBe(503);
  });

  it('rejects bad input', async () => {
    const run = vi.fn(async () => ({ response: 'SELECT 1' }));
    expect((await handleAi(post('not json'), env(run))).status).toBe(400);
    expect((await handleAi(post({ task: 'generate', schema }), env(run))).status).toBe(400);
    expect((await handleAi(post({ task: 'generate', schema, question: 'q' }, { origin: 'https://evil.example' }), env(run))).status).toBe(403);
    expect((await handleAi(new Request('https://app.example/api/ai'), env(run))).status).toBe(405);
    expect(run).not.toHaveBeenCalled();
  });
});
