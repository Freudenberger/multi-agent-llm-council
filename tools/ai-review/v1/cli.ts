#!/usr/bin/env tsx
/**
 * CLI for the AI code-review agent (10xChampion path).
 *
 * Usage:
 *   npm run review -- --diff tools/ai-review/fixtures/sql-injection.diff
 *   npm run review -- --git origin/main        # review working changes vs a ref
 *   git diff | npm run review                   # read diff from stdin
 *
 * Flags:
 *   --diff <file>     read the diff from a file
 *   --git [base]      run `git diff <base>...HEAD` (default base: origin/main)
 *   --json            print only the JSON verdict (for piping)
 *   --comment <file>  also write a Markdown PR-comment body to <file>
 *   --junit <file>    also write a JUnit XML report (for GitHub Actions check runs)
 *   --timeout <sec>   per-provider-call timeout in seconds (default 60; or AI_REVIEW_TIMEOUT)
 *   --no-fail         always exit 0 (don't gate on a "fail" verdict)
 *
 * Exit code: 1 when the verdict is "fail" (so CI can gate), unless --no-fail.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { reviewDiff } from "./reviewAgent";
import { filterDiff } from "../filterDiff";
import { REVIEW_DIMENSIONS, type ReviewVerdict } from "../schema";

const USAGE = `Usage:
  npm run review -- --diff <file>     review a diff file
  npm run review -- --git [base]      review working changes vs a ref (default: origin/main)
  git diff | npm run review           review a piped diff
  
Flags: --json  --comment <file>  --junit <file>  --timeout <sec>  --no-fail  --verbose|-v
`;

/**
 * tsx does not auto-load .env the way Next.js does, so load it here (Node 20.6+
 * built-in). Values already in the environment win. If a key is present but no
 * provider was chosen, default to OpenRouter so `npm run review` "just works".
 */
function loadEnv(): void {
  const load = (
    process as NodeJS.Process & { loadEnvFile?: (p: string) => void }
  ).loadEnvFile;
  for (const f of [".env.local", ".env"]) {
    try {
      load?.(f);
    } catch {
      /* file missing — fine */
    }
  }
  if (!process.env.LLM_PROVIDER) {
    process.env.LLM_PROVIDER = process.env.OPENROUTER_API_KEY
      ? "openrouter"
      : "mock";
  }
}
loadEnv();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
function has(name: string): boolean {
  return process.argv.includes(name);
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function git(args: string[]): string {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}
function refExists(ref: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--verify", "-q", ref], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}
/** First configured remote name (this repo's is "multi-agent-llm-council", not "origin"). */
function firstRemote(): string | undefined {
  try {
    return git(["remote"])
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)[0];
  } catch {
    return undefined;
  }
}
/** Resolve a usable base ref across the common naming variants. */
function resolveBase(explicit?: string): string | undefined {
  const remote = firstRemote();
  const candidates = [
    explicit,
    "origin/main",
    remote && `${remote}/main`,
    remote && `${remote}/master`,
    "main",
    "master",
  ].filter((r): r is string => !!r);
  return candidates.find(refExists);
}
/**
 * Diff against a base ref (PR-style: commits on HEAD since the base). If the
 * base can't be resolved or there are no committed changes, fall back to the
 * uncommitted working-tree diff so a local run still has something to review.
 */
function gitDiff(explicitBase?: string): string {
  if (explicitBase && !refExists(explicitBase)) {
    process.stderr.write(
      `[ai-review] base "${explicitBase}" not found — auto-resolving.\n`,
    );
  }
  const base = resolveBase(explicitBase);
  if (base) {
    const committed = git(["diff", `${base}...HEAD`]);
    if (committed.trim()) {
      process.stderr.write(
        `[ai-review] reviewing committed changes vs ${base}\n`,
      );
      return committed;
    }
  }
  const working = git(["diff", "HEAD"]);
  process.stderr.write(
    working.trim()
      ? `[ai-review] no committed changes vs base — reviewing uncommitted working-tree changes (git diff HEAD)\n`
      : `[ai-review] no changes found (base=${base ?? "none"}).\n`,
  );
  return working;
}

function loadDiff(): string {
  const diffFile = arg("--diff");
  if (diffFile) return readFileSync(diffFile, "utf8");
  if (has("--git")) {
    const explicit =
      arg("--git") && !arg("--git")!.startsWith("--")
        ? arg("--git")
        : undefined;
    return gitDiff(explicit);
  }
  // No explicit source. Reading stdin from a terminal would block forever, so
  // only do it when input is actually piped; otherwise show usage and exit.
  if (process.stdin.isTTY) {
    process.stderr.write(USAGE);
    process.exit(2);
  }
  return readStdin();
}

function emoji(v: ReviewVerdict["verdict"]): string {
  return v === "pass" ? "✅" : "❌";
}

function toMarkdown(
  v: ReviewVerdict,
  model: string,
  degraded: boolean,
): string {
  const rows = REVIEW_DIMENSIONS.map((d) => `| ${d} | ${v[d]}/10 |`).join("\n");
  const findings =
    v.findings && v.findings.length
      ? "\n\n**Findings**\n" +
        v.findings
          .map(
            (f) =>
              `- \`${f.severity}\`${f.file ? ` ${f.file}` : ""}: ${f.note}`,
          )
          .join("\n")
      : "";
  return `### ${emoji(v.verdict)} AI Code Review — **${v.verdict.toUpperCase()}**${
    degraded ? " _(degraded: reviewer output unparsed, failing closed)_" : ""
  }

${v.summary}

| Dimension | Score |
| --- | --- |
${rows}${findings}

<sub>Generated by the 10xChampion AI reviewer (model: \`${model}\`). Rubric: \`tools/ai-review/criteria.md\`.</sub>`;
}

function note(msg: string): void {
  process.stderr.write(`[ai-review] ${msg}\n`);
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Render the verdict as a JUnit XML report so GitHub Actions can surface it as a
 * check run (via dorny/test-reporter). Each scored dimension, each finding, and
 * the overall verdict become test cases; a case "fails" when it breaches the DoD.
 */
function toJUnit(v: ReviewVerdict, model: string, ms: number): string {
  type Case = {
    classname: string;
    name: string;
    failure?: string;
    out?: string;
  };
  const cases: Case[] = [];

  for (const d of REVIEW_DIMENSIONS) {
    const score = v[d];
    const threshold = d === "securitySafety" ? 5 : 3; // DoD thresholds
    cases.push({
      classname: "ai-review.dimensions",
      name: `${d} (${score}/10)`,
      failure:
        score <= threshold
          ? `score ${score} <= threshold ${threshold}`
          : undefined,
    });
  }
  for (const f of v.findings ?? []) {
    const failed = f.severity === "blocker" || f.severity === "major";
    cases.push({
      classname: "ai-review.findings",
      name: `[${f.severity}] ${f.file ?? "general"}`,
      failure: failed ? f.note : undefined,
      out: f.note,
    });
  }
  cases.push({
    classname: "ai-review",
    name: `verdict: ${v.verdict}`,
    failure: v.verdict === "fail" ? v.summary : undefined,
  });

  const failures = cases.filter((c) => c.failure).length;
  const t = (ms / 1000).toFixed(2);
  const body = cases
    .map((c) => {
      const open = `    <testcase classname="${xmlEscape(c.classname)}" name="${xmlEscape(c.name)}" time="0">`;
      const fail = c.failure
        ? `\n      <failure message="${xmlEscape(c.failure)}"></failure>`
        : "";
      const out = c.out
        ? `\n      <system-out>${xmlEscape(c.out)}</system-out>`
        : "";
      return `${open}${fail}${out}\n    </testcase>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="AI Code Review" tests="${cases.length}" failures="${failures}" time="${t}">
  <testsuite name="AI Code Review (${xmlEscape(model)})" tests="${cases.length}" failures="${failures}" time="${t}">
${body}
  </testsuite>
</testsuites>
`;
}

async function main() {
  const verbose = has("--verbose") || has("-v");
  const started = Date.now();
  const { filtered: diff, dropped } = filterDiff(loadDiff());
  if (dropped.length) {
    note(
      `excluded ${dropped.length} non-code file(s) from review: ${dropped.slice(0, 8).join(", ")}${dropped.length > 8 ? "…" : ""}`,
    );
  }

  const files = (diff.match(/^diff --git /gm) || []).length;
  const added = (diff.match(/^\+(?!\+\+)/gm) || []).length;
  const removed = (diff.match(/^-(?!--)/gm) || []).length;
  note(
    `provider=${process.env.LLM_PROVIDER} model=${process.env.OPENROUTER_MODEL ?? "default"} — reviewing ${files} file(s), ${diff ? diff.split("\n").length : 0} diff lines (+${added}/-${removed})…`,
  );
  if (verbose && files > 0) {
    const names = (diff.match(/^diff --git a\/(\S+)/gm) || [])
      .map((l) => l.replace(/^diff --git a\//, ""))
      .slice(0, 20);
    note(
      `files: ${names.join(", ")}${files > names.length ? ` (+${files - names.length} more)` : ""}`,
    );
  }

  const timeoutArg = arg("--timeout") ?? process.env.AI_REVIEW_TIMEOUT;
  const timeoutMs = timeoutArg
    ? Math.max(1, Number(timeoutArg)) * 1000
    : undefined;

  const { verdict, model, degraded } = await reviewDiff(diff, {
    onEvent: verbose ? note : undefined,
    timeoutMs,
  });
  note(
    `done in ${Date.now() - started}ms — verdict=${verdict.verdict}${degraded ? " (degraded)" : ""}, model=${model}, findings=${verdict.findings?.length ?? 0}`,
  );
  const markdown = toMarkdown(verdict, model, degraded);

  const commentFile = arg("--comment");
  if (commentFile) writeFileSync(commentFile, markdown, "utf8");

  const junitFile = arg("--junit");
  if (junitFile) {
    writeFileSync(
      junitFile,
      toJUnit(verdict, model, Date.now() - started),
      "utf8",
    );
    note(`wrote JUnit report to ${junitFile}`);
  }

  if (has("--json")) {
    process.stdout.write(JSON.stringify(verdict, null, 2) + "\n");
  } else {
    process.stdout.write(markdown + "\n");
  }

  if (verdict.verdict === "fail" && !has("--no-fail")) process.exit(1);
}

main().catch((err) => {
  console.error("AI review failed:", err instanceof Error ? err.message : err);
  process.exit(2);
});
