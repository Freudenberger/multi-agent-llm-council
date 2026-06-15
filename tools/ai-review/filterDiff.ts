/**
 * Drops non-application-code sections from a unified `git diff` before review.
 *
 * Reviewing these produces noise and false "code-convention" findings — e.g. the
 * permission entries in `.claude/settings.local.json` get mistaken for source,
 * or a docs/CI change triggers "Core/UI independence" complaints. The set below
 * matches the categories the reviewer prompt calls "not application code":
 * documentation, agent/editor config, lockfiles, CI YAML, and generated output.
 */
export const EXCLUDE_PATHS: RegExp[] = [
  // Lockfiles
  /(^|\/)package-lock\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)yarn\.lock$/,
  // Agent / editor config (permission lists, not code)
  /(^|\/)\.claude\//,
  /(^|\/)\.vscode\//,
  // CI / workflows (YAML config, not application code)
  /(^|\/)\.github\//,
  // Documentation
  /\.mdx?$/i,
  // Secrets / env
  /(^|\/)\.env(\.|$)/,
  // Generated / vendored / build output
  /(^|\/)(dist|build|out|\.next|coverage|node_modules)\//,
  /\.min\.(js|css)$/,
  /\.(snap|lock)$/,
];

export type FilterResult = { filtered: string; dropped: string[] };

/** Split a unified diff into per-file sections and drop the excluded paths. */
export function filterDiff(diff: string, exclude: RegExp[] = EXCLUDE_PATHS): FilterResult {
  if (!/^diff --git /m.test(diff)) return { filtered: diff, dropped: [] };
  const dropped: string[] = [];
  const filtered = diff
    .split(/(?=^diff --git )/m)
    .filter((section) => {
      const m = section.match(/^diff --git a\/(\S+) b\/(\S+)/);
      if (!m) return true; // preamble / unrecognised — keep
      const path = m[2] || m[1];
      if (exclude.some((re) => re.test(path))) {
        dropped.push(path);
        return false;
      }
      return true;
    })
    .join("");
  return { filtered, dropped };
}
