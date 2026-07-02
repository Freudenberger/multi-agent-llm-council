import { NextResponse } from "next/server";
import pkg from "../../../../package.json";

// Exposes the app version (from package.json) so the footer can show it.
// APP_VERSION env wins when set (e.g. a build stamps it); otherwise fall back
// to the package version so dev/local always shows something real.
// Also reports whether the server defaults to the mock provider so the UI can
// tell users responses are simulated (a user's own key still overrides this
// per-request — see createProvider).
export function GET() {
  return NextResponse.json({
    version: process.env.APP_VERSION ?? pkg.version,
    mockMode: (process.env.LLM_PROVIDER ?? "mock") === "mock",
  });
}
