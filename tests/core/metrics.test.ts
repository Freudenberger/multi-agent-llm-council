import { describe, it, expect, beforeEach } from "vitest";
import {
  incr,
  observeDuration,
  renderMetrics,
  snapshotMetrics,
  resetMetrics,
} from "@/core/metrics";

describe("metrics", () => {
  beforeEach(() => resetMetrics());

  it("accumulates counters per label set and renders Prometheus text", () => {
    incr("council_runs_total", { mode: "decision", status: "ok" });
    incr("council_runs_total", { mode: "decision", status: "ok" });
    incr("council_runs_total", { mode: "idea", status: "error" });

    const out = renderMetrics();
    expect(out).toContain("# TYPE council_runs_total counter");
    expect(out).toContain(
      'council_runs_total{mode="decision",status="ok"} 2',
    );
    expect(out).toContain('council_runs_total{mode="idea",status="error"} 1');
  });

  it("renders durations as summary _sum/_count pairs", () => {
    observeDuration("council_run_duration_ms", 100, { mode: "decision" });
    observeDuration("council_run_duration_ms", 300, { mode: "decision" });

    const out = renderMetrics();
    expect(out).toContain("# TYPE council_run_duration_ms summary");
    expect(out).toContain(
      'council_run_duration_ms_sum{mode="decision"} 400',
    );
    expect(out).toContain(
      'council_run_duration_ms_count{mode="decision"} 2',
    );
  });

  it("snapshots structured counters and durations with avg latency", () => {
    incr("council_runs_total", { mode: "decision", status: "ok" });
    observeDuration("council_run_duration_ms", 100, { mode: "decision" });
    observeDuration("council_run_duration_ms", 300, { mode: "decision" });

    const snap = snapshotMetrics();
    expect(snap.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(snap.counters).toContainEqual({
      name: "council_runs_total",
      labels: { mode: "decision", status: "ok" },
      value: 1,
    });
    expect(snap.durations).toContainEqual({
      name: "council_run_duration_ms",
      labels: { mode: "decision" },
      sum: 400,
      count: 2,
      avgMs: 200,
    });
  });

  it("escapes label values and always emits process_uptime_seconds", () => {
    incr("weird", { label: 'a"b\\c' });
    const out = renderMetrics();
    expect(out).toContain("process_uptime_seconds");
    expect(out).toContain('weird{label="a\\"b\\\\c"} 1');
  });
});
