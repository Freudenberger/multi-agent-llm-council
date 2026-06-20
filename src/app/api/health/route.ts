import { NextResponse } from "next/server";

// Liveness/readiness probe — intentionally auth-independent and dependency-free.
// Used by the Docker HEALTHCHECK and the CI smoke tests (a simple curl target).
// Must never touch the DB, the LLM provider, or `auth()` so it stays a pure
// "is the server process up?" signal.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      version: process.env.APP_VERSION ?? "unknown",
      sha: process.env.GIT_SHA ?? "unknown",
      uptimeSeconds: Math.round(process.uptime()),
    },
    // A liveness probe must reflect the server's current state, never a cached
    // copy. Without this, an intermediary proxy/CDN could serve a stale "ok"
    // (or stale version/uptime) and defeat the point of the HEALTHCHECK.
    { headers: { "Cache-Control": "no-store" } },
  );
}
