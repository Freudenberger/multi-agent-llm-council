"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const BASE_INPUT_CLASS =
  "w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:border-transparent";

function fieldClass(errors?: string[]): string {
  return errors
    ? `${BASE_INPUT_CLASS} border-red-500 dark:border-red-500 focus:ring-red-500`
    : `${BASE_INPUT_CLASS} border-zinc-300 dark:border-zinc-700 focus:ring-blue-500`;
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setFieldErrors({});

      // Client-side validation that mirrors the server schema, so the user
      // gets immediate, specific feedback before a round-trip.
      const clientErrors: Record<string, string[]> = {};
      if (name.trim().length < 2) {
        clientErrors.name = ["Name must be at least 2 characters"];
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        clientErrors.email = ["Invalid email address"];
      }
      if (password.length < 6) {
        clientErrors.password = ["Password must be at least 6 characters"];
      }
      if (password !== confirmPassword) {
        clientErrors.confirmPassword = ["Passwords do not match"];
      }
      if (Object.keys(clientErrors).length > 0) {
        setFieldErrors(clientErrors);
        setError("Please fix the highlighted fields below.");
        return;
      }

      setLoading(true);

      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          // The API returns field-level messages in `details` for validation
          // failures (e.g. { name: ["Name must be at least 2 characters"] }).
          // Surface them so the user knows exactly what to fix.
          if (data.details && typeof data.details === "object") {
            setFieldErrors(data.details as Record<string, string[]>);
            const messages = Object.values(
              data.details as Record<string, string[]>,
            )
              .flat()
              .filter(Boolean);
            setError(
              messages.length > 0
                ? messages.join(" ")
                : data.error || "Registration failed",
            );
          } else {
            setError(data.error || "Registration failed");
          }
          return;
        }

        // Redirect to login after successful registration
        router.push("/login?registered=true");
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [name, email, password, confirmPassword, router],
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <span className="text-4xl">🏛️</span>
          <h1 className="text-2xl font-bold mt-3">Create an account</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Join the council and start analyzing with AI agents
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1.5">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              autoComplete="name"
              placeholder="Your name"
              aria-invalid={fieldErrors.name ? true : undefined}
              aria-describedby={fieldErrors.name ? "name-error" : undefined}
              className={fieldClass(fieldErrors.name)}
            />
            {fieldErrors.name && (
              <p id="name-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.name.join(" ")}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              className={fieldClass(fieldErrors.email)}
            />
            {fieldErrors.email && (
              <p id="email-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.email.join(" ")}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              className={fieldClass(fieldErrors.password)}
            />
            {fieldErrors.password && (
              <p id="password-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.password.join(" ")}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1.5">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Repeat your password"
              aria-invalid={fieldErrors.confirmPassword ? true : undefined}
              aria-describedby={fieldErrors.confirmPassword ? "confirmPassword-error" : undefined}
              className={fieldClass(fieldErrors.confirmPassword)}
            />
            {fieldErrors.confirmPassword && (
              <p id="confirmPassword-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.confirmPassword.join(" ")}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !name || !email || !password || !confirmPassword}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {/* Login link */}
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
