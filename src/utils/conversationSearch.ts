/**
 * Helper for searching conversations by title.
 */

export interface ConversationSearchRow {
  id: string;
  title: string;
}

/** A SQL fragment plus its bound parameters — never interpolate values inline. */
export interface SqlFragment {
  /** Clause text with a positional placeholder (`$1`). */
  clause: string;
  /** Values bound to the placeholders, in order. */
  params: string[];
}

/**
 * Build a parameterized SQL WHERE clause matching conversation titles against a
 * user-supplied search term. The term is passed as a bound parameter, so it is
 * safe against SQL injection.
 */
export function buildTitleSearchClause(searchTerm: string): SqlFragment {
  return {
    clause: `title LIKE $1`,
    params: [`%${searchTerm}%`],
  };
}

/**
 * Filter already-loaded rows by a case-sensitive substring match.
 */
export function filterByTitle(
  rows: ConversationSearchRow[],
  searchTerm: string,
): ConversationSearchRow[] {
  return rows.filter((row) => row.title.includes(searchTerm));
}
