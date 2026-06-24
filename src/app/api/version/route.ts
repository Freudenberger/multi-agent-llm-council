import { NextResponse } from "next/server";
import pkg from "../../../../package.json";

// Exposes the app version (from package.json) so the footer can show it.
// APP_VERSION env wins when set (e.g. a build stamps it); otherwise fall back
// to the package version so dev/local always shows something real.
export function GET() {
  return NextResponse.json({ version: process.env.APP_VERSION ?? pkg.version });
}
