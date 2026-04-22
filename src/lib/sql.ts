/** Removes string literals and comments so their contents aren't mistaken for identifiers. */
export function stripLiteralsAndComments(sql: string): string {
  return sql.replace(/'(?:[^']|'')*'|--[^\n]*|\/\*[\s\S]*?\*\//g, ' ');
}

/**
 * Which of the known tables a query mentions. A lightweight text check
 * (used only for the "over N rows" figure), matching names case-insensitively
 * as whole words or inside double quotes.
 */
export function tablesMentioned(sql: string, tableNames: string[]): string[] {
  const code = stripLiteralsAndComments(sql).toLowerCase();
  return tableNames.filter((name) => {
    const lower = name.toLowerCase();
    if (code.includes(`"${lower.replaceAll('"', '""')}"`)) return true;
    if (!/^[a-z_][a-z0-9_]*$/.test(lower)) return false;
    return new RegExp(`(?<![a-z0-9_"])${lower}(?![a-z0-9_"])`).test(code);
  });
}

/**
 * Returns a single statement that can be wrapped in a subquery: trailing
 * semicolons are removed, along with any comments that follow them.
 * Semicolons inside strings, quoted names and comments are left alone.
 */
export function withoutTrailingSemicolon(sql: string): string {
  const token = /'(?:[^']|'')*'|"(?:[^"]|"")*"|--[^\n]*|\/\*[\s\S]*?\*\/|\s+|;|[^'"\-\/;\s]+|[-\/]/g;
  let end = 0; // end of the last meaningful token
  let cut: number | null = null; // start of a run of trailing semicolons
  for (const match of sql.matchAll(token)) {
    const text = match[0];
    const isFiller = /^\s/.test(text) || text.startsWith('--') || text.startsWith('/*');
    if (isFiller) continue;
    if (text === ';') {
      cut ??= end;
    } else {
      cut = null;
      end = match.index + text.length;
    }
  }
  return (cut === null ? sql : sql.slice(0, cut)).trim();
}
