/**
 * Tiny in-process metrics registry rendered in Prometheus text exposition
 * format. No dependency — the format is just text, and a single Next.js server
 * process only needs counters + duration summaries.
 *
 * ponytail: in-process only. Counts reset on restart and aren't shared across
 * instances. Fine for a single-process deploy; switch to prom-client + a
 * pushgateway (or OTel metrics) if you scale horizontally.
 *
 * Usage:
 *   import { incr, observeDuration } from "@/core/metrics";
 *   incr("council_runs_total", { mode, status: "ok" });
 *   observeDuration("council_run_duration_ms", durationMs, { mode });
 */

export type Labels = Record<string, string>;

// Each series is keyed by its rendered label string; the value keeps the
// original labels object too so a JSON snapshot can hand them back structured.
const counters = new Map<string, Map<string, { labels: Labels; value: number }>>();
const durations = new Map<
  string,
  Map<string, { labels: Labels; sum: number; count: number }>
>();

/** Render labels as a Prometheus `{k="v",...}` suffix (sorted for stable output). */
function labelStr(labels: Labels): string {
  const parts = Object.entries(labels)
    .filter(([, v]) => v != null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${escapeLabel(String(v))}"`);
  return parts.length ? `{${parts.join(",")}}` : "";
}

function escapeLabel(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function group<T>(
  store: Map<string, Map<string, T>>,
  name: string,
): Map<string, T> {
  let m = store.get(name);
  if (!m) {
    m = new Map();
    store.set(name, m);
  }
  return m;
}

export function incr(name: string, labels: Labels = {}, by = 1): void {
  const m = group(counters, name);
  const key = labelStr(labels);
  const cur = m.get(key) ?? { labels, value: 0 };
  cur.value += by;
  m.set(key, cur);
}

export function observeDuration(
  name: string,
  ms: number,
  labels: Labels = {},
): void {
  const m = group(durations, name);
  const key = labelStr(labels);
  const cur = m.get(key) ?? { labels, sum: 0, count: 0 };
  cur.sum += ms;
  cur.count += 1;
  m.set(key, cur);
}

/** Serialize all metrics in Prometheus text exposition format. */
export function renderMetrics(): string {
  const lines: string[] = [];

  lines.push("# TYPE process_uptime_seconds gauge");
  lines.push(`process_uptime_seconds ${Math.round(process.uptime())}`);

  for (const [name, series] of counters) {
    lines.push(`# TYPE ${name} counter`);
    for (const [labelKey, { value }] of series) {
      lines.push(`${name}${labelKey} ${value}`);
    }
  }

  // Expose duration summaries as Prometheus summary _sum/_count pairs, which
  // gives average latency (sum/count) without committing to histogram buckets.
  for (const [name, series] of durations) {
    lines.push(`# TYPE ${name} summary`);
    for (const [labelKey, { sum, count }] of series) {
      lines.push(`${name}_sum${labelKey} ${sum}`);
      lines.push(`${name}_count${labelKey} ${count}`);
    }
  }

  return lines.join("\n") + "\n";
}

export interface MetricsSnapshot {
  uptimeSeconds: number;
  counters: { name: string; labels: Labels; value: number }[];
  durations: {
    name: string;
    labels: Labels;
    sum: number;
    count: number;
    avgMs: number;
  }[];
}

/** Structured view of all metrics — used by the JSON endpoint and the page. */
export function snapshotMetrics(): MetricsSnapshot {
  const counterList: MetricsSnapshot["counters"] = [];
  for (const [name, series] of counters) {
    for (const { labels, value } of series.values()) {
      counterList.push({ name, labels, value });
    }
  }

  const durationList: MetricsSnapshot["durations"] = [];
  for (const [name, series] of durations) {
    for (const { labels, sum, count } of series.values()) {
      durationList.push({
        name,
        labels,
        sum,
        count,
        avgMs: count ? Math.round(sum / count) : 0,
      });
    }
  }

  return {
    uptimeSeconds: Math.round(process.uptime()),
    counters: counterList,
    durations: durationList,
  };
}

/** Reset all metrics — test-only. */
export function resetMetrics(): void {
  counters.clear();
  durations.clear();
}
