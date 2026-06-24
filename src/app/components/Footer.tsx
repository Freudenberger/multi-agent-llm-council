"use client";

import { useEffect, useState } from "react";

/** Site footer — shows the disclaimer and the backend-reported app version. */
export function Footer() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/version")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.version) setVersion(d.version);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4 text-center text-xs text-zinc-500 print:hidden">
      Multi-Agent LLM Council{version ? ` · v${version}` : ""} — Supports analysis
      by showing multiple perspectives. Does not guarantee correctness. Created by{" "}
      <a href="https://github.com/Freudenberger" className="text-blue-500 hover:underline">
        Freudenberger
      </a>
      .
    </footer>
  );
}
