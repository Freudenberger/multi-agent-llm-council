"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ModelStat } from "@/core/modelStats";

// Model comparison dashboard — compares how each LLM model performed across the
// logged-in user's saved council runs. Logged-in only (mirrors /settings).

export default function DashboardPage() {
  const { status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<ModelStat[] | null>(null);
  const [conversationCount, setConversationCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations/stats", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data.stats);
      setConversationCount(data.conversationCount);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    // Defer the fetch out of the effect body so the only synchronous work here
    // is scheduling — avoids the react-hooks/set-state-in-effect cascade.
    if (status !== "authenticated") return;
    const id = window.setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [status, load]);

  if (status === "loading") {
    return <main className="mx-auto max-w-3xl p-6">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Model Comparison</h1>
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← Back
        </Link>
      </div>

      {error && <p className="text-red-500">Failed to load: {error}</p>}

      {stats && stats.length === 0 && (
        <p className="text-zinc-500">
          No data yet — run a council and your model stats will appear here.
        </p>
      )}

      {stats && stats.length > 0 && (
        <>
          <p className="mb-4 text-sm text-zinc-500">
            Across {conversationCount} saved{" "}
            {conversationCount === 1 ? "run" : "runs"}.
          </p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-400 dark:border-zinc-700">
                <th className="py-2 font-normal">Model</th>
                <th className="py-2 text-right font-normal">Responses</th>
                <th className="py-2 text-right font-normal">Avg confidence</th>
                <th className="py-2 pl-4 font-normal">Modes</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr
                  key={s.model}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="py-2 font-medium">{s.model}</td>
                  <td className="py-2 text-right">{s.responseCount}</td>
                  <td className="py-2 text-right">
                    {s.avgConfidence.toFixed(1)} / 5
                  </td>
                  <td className="py-2 pl-4 text-zinc-500">
                    {s.modes.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
