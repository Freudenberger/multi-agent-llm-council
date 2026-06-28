"use client";

import { useCallback, useEffect, useState } from "react";

// Hidden ops page (not linked in nav) for eyeballing the in-process metrics.
// Reads /api/metrics?format=json and refreshes on an interval.
// ponytail: plain tables, no charting lib — counts and avg latency is all the
// in-process registry has. Add a dashboard lib only if you outgrow this.

interface Snapshot {
  uptimeSeconds: number;
  counters: { name: string; labels: Record<string, string>; value: number }[];
  durations: {
    name: string;
    labels: Record<string, string>;
    count: number;
    avgMs: number;
  }[];
}

function labelsText(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  return entries.length ? entries.map(([k, v]) => `${k}=${v}`).join(", ") : "—";
}

export default function MetricsPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/metrics?format=json", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    // Defer the first run so the effect only wires up timers/subscriptions;
    // this keeps the initial fetch out of the effect body for the React hooks
    // lint rule while preserving the same user-visible behavior.
    const initialId = window.setTimeout(() => {
      void load();
    }, 0);
    const intervalId = window.setInterval(() => {
      void load();
    }, 5000);

    return () => {
      clearTimeout(initialId);
      clearInterval(intervalId);
    };
  }, [load]);

  return (
    <main className="mx-auto max-w-4xl p-6 font-mono text-sm">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">Metrics</h1>
        <button
          onClick={load}
          className="rounded border px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Refresh
        </button>
      </div>

      {error && <p className="text-red-600">Failed to load: {error}</p>}
      {!data && !error && <p>Loading…</p>}

      {data && (
        <>
          <p className="mb-6 text-gray-500">
            Uptime: {data.uptimeSeconds}s · auto-refresh 5s
          </p>

          <Section title="Counters">
            <Table headers={["Metric", "Labels", "Value"]}>
              {data.counters.map((c, i) => (
                <tr key={i} className="border-t dark:border-gray-700">
                  <td className="py-1 pr-4">{c.name}</td>
                  <td className="py-1 pr-4 text-gray-500">
                    {labelsText(c.labels)}
                  </td>
                  <td className="py-1 text-right">{c.value}</td>
                </tr>
              ))}
            </Table>
          </Section>

          <Section title="Durations">
            <Table headers={["Metric", "Labels", "Count", "Avg (ms)"]}>
              {data.durations.map((d, i) => (
                <tr key={i} className="border-t dark:border-gray-700">
                  <td className="py-1 pr-4">{d.name}</td>
                  <td className="py-1 pr-4 text-gray-500">
                    {labelsText(d.labels)}
                  </td>
                  <td className="py-1 pr-4 text-right">{d.count}</td>
                  <td className="py-1 text-right">{d.avgMs}</td>
                </tr>
              ))}
            </Table>
          </Section>
        </>
      )}
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Table({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <table className="w-full text-left">
      <thead>
        <tr className="text-gray-400">
          {headers.map((h, i) => (
            <th
              key={h}
              className={`pb-1 font-normal ${i >= 2 ? "text-right" : ""}`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
