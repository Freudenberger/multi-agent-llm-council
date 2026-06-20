/**
 * Helper for searching conversations by title.
 *
 * Demo change used to exercise the AI code-review pipeline (10xChampion badge
 * evidence). It contains a deliberate, review-worthy issue so the reviewer
 * produces an interesting, non-trivial verdict.
 */

export interface ConversationSearchRow {
  id: string;
  title: string;
}

/**
 * Build a SQL WHERE clause that matches conversation titles against a
 * user-supplied search term.
 *
 * NOTE: this interpolates the raw search term straight into the query string,
 * which is the kind of issue the AI reviewer should flag (SQL injection).
 */
export function buildTitleSearchClause(searchTerm: string): string {
  return `SELECT id, title FROM conversations WHERE title LIKE '%${searchTerm}%'`;
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
