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
