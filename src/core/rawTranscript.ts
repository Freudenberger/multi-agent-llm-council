/**
 * Raw transcript logger — captures the COMPLETE, untruncated record of a
 * council run and appends it to a file on disk. Two kinds of records are
 * written to the same per-run file:
 *
 *   - "exchange" — one per model call: the full system prompt, full user
 *     message, and the full raw model response (every specialist, plus every
 *     final-judge attempt including retries). Written via `logRawExchange`.
 *   - "event"    — lifecycle markers: run started, specialists completed, the
 *     exact judge request (with the de-anonymized specialist mapping), and the
 *     final report. Written via `logRawEvent`.
 *
 * This is deliberately separate from the structured `logger` (src/core/logger.ts):
 *   - `logger` is for operational tracing — short, level-filtered, goes to stdout.
 *   - the raw transcript is for debugging / auditing / replay — full content,
 *     NO truncation, regardless of LOG_LEVEL.
 *
 * Disabled by default. Enable with the env switch:
 *   COUNCIL_RAW_LOG=true        (also accepts 1 / yes / on)
 *
 * Optional configuration:
 *   COUNCIL_RAW_LOG_DIR     directory for transcript files (default: ./logs/council)
 *   COUNCIL_RAW_LOG_FORMAT  "jsonl" (default, one JSON object per line) | "text"
 *
 * One file is written per run, named "<runId>.<jsonl|log>". Logging failures are
 * swallowed and reported via the structured logger — they must never break a run.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger";

export type RawExchangeRole = "specialist" | "judge";

/** A single raw model request/response captured for the transcript. */
export type RawExchange = {
  runId: string;
  agentId: string;
  agentName: string;
  role: RawExchangeRole;
  /** Resolved model id when known, otherwise the requested model. */
  model: string;
  /** The full system prompt sent to the model — not truncated. */
  systemPrompt: string;
  /** The full user message sent to the model — not truncated. */
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  /** The full raw model response, or null when the call failed. */
  response: string | null;
  /** Error message when the call failed. */
  error?: string;
  durationMs: number;
};

const DEFAULT_DIR = join(process.cwd(), "logs", "council");
const TRUTHY = new Set(["1", "true", "yes", "on"]);

/** Whether raw transcript logging is enabled via COUNCIL_RAW_LOG. */
export function isRawLogEnabled(): boolean {
  const flag = process.env.COUNCIL_RAW_LOG?.trim().toLowerCase();
  return flag !== undefined && TRUTHY.has(flag);
}

function getDir(): string {
  return process.env.COUNCIL_RAW_LOG_DIR?.trim() || DEFAULT_DIR;
}

function getFormat(): "jsonl" | "text" {
  return process.env.COUNCIL_RAW_LOG_FORMAT?.trim().toLowerCase() === "text"
    ? "text"
    : "jsonl";
}

/** runIds are generated internally, but sanitize defensively for filenames. */
function safeRunId(runId: string): string {
  return runId.replace(/[^a-zA-Z0-9._-]/g, "_") || "run";
}

const ensuredDirs = new Set<string>();

function ensureDir(dir: string): void {
  if (ensuredDirs.has(dir)) return;
  mkdirSync(dir, { recursive: true });
  ensuredDirs.add(dir);
}

/**
 * Shared write path for both exchanges and events. No-op when disabled, never
 * throws. Uses a synchronous append so concurrent specialist calls within the
 * same process each write a single atomic record and cannot interleave.
 */
function writeRecord(
  runId: string,
  build: (timestamp: string) => { json: Record<string, unknown>; text: string },
): void {
  if (!isRawLogEnabled()) return;
  try {
    const dir = getDir();
    ensureDir(dir);
    // Timestamp captured here rather than threaded in, so callers stay simple.
    const timestamp = new Date().toISOString();
    const { json, text } = build(timestamp);
    const format = getFormat();
    const ext = format === "text" ? "log" : "jsonl";
    const file = join(dir, `${safeRunId(runId)}.${ext}`);
    appendFileSync(file, format === "text" ? text : JSON.stringify(json) + "\n", "utf8");
  } catch (err) {
    logger.error("Failed to write raw transcript record", {
      runId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function formatExchangeText(entry: RawExchange, timestamp: string): string {
  const sep = "─".repeat(72);
  return [
    sep,
    `[${timestamp}] EXCHANGE · ${entry.role.toUpperCase()} — ${entry.agentName} (${entry.agentId})`,
    `model=${entry.model} durationMs=${entry.durationMs}` +
      (entry.temperature !== undefined ? ` temperature=${entry.temperature}` : "") +
      (entry.maxTokens !== undefined ? ` maxTokens=${entry.maxTokens}` : ""),
    "",
    "── SYSTEM PROMPT ──",
    entry.systemPrompt,
    "",
    "── USER MESSAGE ──",
    entry.userMessage,
    "",
    entry.error ? "── ERROR ──" : "── RESPONSE ──",
    entry.error ?? entry.response ?? "",
    "",
  ].join("\n");
}

function formatEventText(
  event: string,
  data: Record<string, unknown>,
  timestamp: string,
): string {
  const sep = "═".repeat(72);
  return [
    sep,
    `[${timestamp}] EVENT · ${event}`,
    JSON.stringify(data, null, 2),
    "",
  ].join("\n");
}

/**
 * Appends one raw exchange (a single model call) to the run's transcript file.
 * No-op when COUNCIL_RAW_LOG is not enabled. Never throws.
 */
export function logRawExchange(entry: RawExchange): void {
  writeRecord(entry.runId, (timestamp) => ({
    json: { timestamp, kind: "exchange", ...entry },
    text: formatExchangeText(entry, timestamp),
  }));
}

/**
 * Appends one lifecycle event (run started, specialists completed, judge
 * request, final report, …) to the run's transcript file. `data` is recorded
 * verbatim and untruncated. No-op when COUNCIL_RAW_LOG is not enabled. Never throws.
 */
export function logRawEvent(
  runId: string,
  event: string,
  data: Record<string, unknown> = {},
): void {
  writeRecord(runId, (timestamp) => ({
    json: { timestamp, kind: "event", runId, event, ...data },
    text: formatEventText(event, data, timestamp),
  }));
}
