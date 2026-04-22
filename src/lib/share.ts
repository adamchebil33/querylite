export interface SharedQuery {
  sql: string;
  /** Ids of the sample datasets the query needs. */
  samples: string[];
}

/**
 * Builds the URL fragment for a share link. Only the SQL text and the names
 * of built-in sample datasets go in; a visitor's own data is never included.
 * A fragment (after "#") is also never sent to any server by the browser.
 */
export function encodeShare({ sql, samples }: SharedQuery): string {
  const params = new URLSearchParams();
  if (samples.length > 0) params.set('data', samples.join(','));
  params.set('sql', sql);
  return `#${params.toString()}`;
}

/** Reads a share link's fragment, or returns null if it isn't one. */
export function decodeShare(hash: string, knownSamples: string[]): SharedQuery | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const sql = params.get('sql')?.trim();
  if (!sql) return null;
  const samples = (params.get('data') ?? '')
    .split(',')
    .filter((id) => knownSamples.includes(id));
  return { sql, samples: [...new Set(samples)] };
}
