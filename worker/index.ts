import {
  BadRequest,
  buildMessages,
  extractSql,
  LIMITS,
  parseAiRequest,
  type AiErrorCode,
  type AiResponse,
} from '../shared/ai';

/** The parts of the Cloudflare environment the Worker uses. */
export interface Env {
  AI?: { run(model: string, input: unknown): Promise<unknown> };
  AI_RATE_LIMIT?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  AI_MODEL?: string;
}

const DEFAULT_MODEL = '@cf/qwen/qwen2.5-coder-32b-instruct';

function reply(body: AiResponse, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

function fail(error: AiErrorCode, message: string, status: number): Response {
  return reply({ ok: false, error, message }, status);
}

/** Models answer in slightly different shapes; accept the common ones. */
function replyText(output: unknown): string {
  if (typeof output === 'string') return output;
  const o = output as {
    response?: unknown;
    choices?: { message?: { content?: unknown } }[];
  } | null;
  if (typeof o?.response === 'string') return o.response;
  const content = o?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : '';
}

/**
 * POST /api/ai: turns a question into SQL, explains a query, or fixes one.
 * It receives table and column names only (see shared/ai.ts), never data.
 */
export async function handleAi(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return fail('bad_request', 'Use POST.', 405);

  // Only this site's own pages may spend the AI allowance.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return fail('bad_request', 'Cross-site requests are not allowed.', 403);
  }

  const raw = await request.text();
  if (raw.length > LIMITS.bodyBytes) return fail('bad_request', 'Request is too large.', 413);
  let parsed;
  try {
    parsed = parseAiRequest(JSON.parse(raw));
  } catch (error) {
    const message = error instanceof BadRequest ? error.message : 'Body must be valid JSON.';
    return fail('bad_request', message, 400);
  }

  // Per-visitor limit so one person can't use up the shared free allowance.
  const visitor = request.headers.get('cf-connecting-ip') ?? 'local';
  const limit = await env.AI_RATE_LIMIT?.limit({ key: visitor }).catch(() => null);
  if (limit && !limit.success) {
    return fail('rate_limited', 'Too many AI requests. Please wait a minute and try again.', 429);
  }

  if (!env.AI) return fail('unavailable', 'AI is not configured on this server.', 503);
  try {
    const output = await env.AI.run(env.AI_MODEL ?? DEFAULT_MODEL, {
      messages: buildMessages(parsed),
      max_tokens: parsed.task === 'explain' ? 250 : 500,
      temperature: 0.1,
    });
    const answer = replyText(output).trim();
    if (!answer) throw new Error('empty reply');
    return reply({ ok: true, text: parsed.task === 'explain' ? answer : extractSql(answer) });
  } catch {
    // Includes the free daily allowance running out. Never leak internals.
    return fail(
      'unavailable',
      'AI is unavailable right now (the free daily allowance may be used up). Everything else still works.',
      503,
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return Response.json({ ok: true });
    if (url.pathname === '/api/ai') return handleAi(request, env);
    return Response.json({ error: 'Not found' }, { status: 404 });
  },
};
