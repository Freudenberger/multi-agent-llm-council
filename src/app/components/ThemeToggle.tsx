"use client";

import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

/**
 * Light/dark theme toggle (SR-14). The initial `.dark` class is applied by the
 * no-FOUC script in layout.tsx; this component reads that class as external
 * state (via useSyncExternalStore, so there's no setState-in-effect and no
 * hydration mismatch), then flips it and persists the choice to localStorage
 * under the `theme` key.
 */

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

// SSR + first-paint default matches the no-FOUC script's default (dark).
function getServerSnapshot(): Theme {
  return "dark";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDark = theme === "dark";

  const toggle = useCallback(() => {
    const next: Theme = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // localStorage unavailable (e.g. privacy mode) — the toggle still applies
      // for this session, it just won't persist.
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {/* Sun shown in dark mode (click → light); moon shown in light mode. */}
      <span aria-hidden="true" className="text-base leading-none">
        {isDark ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
