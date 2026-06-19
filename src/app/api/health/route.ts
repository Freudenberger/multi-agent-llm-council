import { NextResponse } from "next/server";

// Liveness/readiness probe — intentionally auth-independent and dependency-free.
// Used by the Docker HEALTHCHECK and the CI smoke tests (a simple curl target).
// Must never touch the DB, the LLM provider, or `auth()` so it stays a pure
// "is the server process up?" signal.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    version: process.env.APP_VERSION ?? "unknown",
    sha: process.env.GIT_SHA ?? "unknown",
    uptimeSeconds: Math.round(process.uptime()),
  });
}
