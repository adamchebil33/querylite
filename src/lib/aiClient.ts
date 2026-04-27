import { buildAiRequest, type AiResponse, type AiTask } from '../../shared/ai';

export class AiError extends Error {}

const FALLBACK = 'AI is unavailable right now. Everything else still works.';

/**
 * Sends a request to the AI endpoint. The body is built by `buildAiRequest`,
 * which copies only table names, column names and column types from `tables`.
 */
export async function askAi(
  task: AiTask,
  tables: { name: string; columns: { name: string; type: string }[] }[],
  input: { question?: string; sql?: string; error?: string },
): Promise<string> {
  let response: Response;
  try {
    response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildAiRequest(task, tables, input)),
    });
  } catch {
    throw new AiError('Could not reach the AI service. Check your connection; everything else still works.');
  }
  let body: AiResponse | null = null;
  try {
    body = (await response.json()) as AiResponse;
  } catch {
    // Not JSON (for example an error page): fall through to the generic message.
  }
  if (body?.ok && body.text.trim()) return body.text.trim();
  throw new AiError(body && !body.ok && body.message ? body.message : FALLBACK);
}
