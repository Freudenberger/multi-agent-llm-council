"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const handleSignOut = useCallback(async () => {
    // Don't let NextAuth compute the post-signout redirect: behind a reverse
    // proxy (Render) the server resolves the relative callbackUrl against the
    // internally-detected host (localhost:10000) and sends the browser there.
    // Clear the session, then navigate to "/" relative to the real origin.
    await signOut({ redirect: false });
    window.location.href = "/";
  }, []);

  // Loading state
  if (status === "loading") {
    return (
      <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
    );
  }

  // Logged in
  if (session?.user) {
    const initials = (session.user.name || session.user.email || "?")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen(!open)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Account menu"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          title={session.user.email || ""}
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
            {initials}
          </div>
          <span className="hidden sm:block text-sm text-zinc-600 dark:text-zinc-300 max-w-[120px] truncate">
            {session.user.name || session.user.email}
          </span>
          <svg
            className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div role="menu" className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                {session.user.name || "User"}
              </p>
              <p className="text-xs text-zinc-500 truncate">{session.user.email}</p>
            </div>
            <div className="py-1">
              <Link
                href="/dashboard"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block w-full text-left px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                📊 Model Comparison
              </Link>
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block w-full text-left px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                ⚙️ Settings
              </Link>
              <button
                role="menuitem"
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Logged out
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
      >
        Sign in
      </Link>
      <Link
        href="/register"
        className="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
      >
        Register
      </Link>
    </div>
  );
}
