import { NextResponse } from "next/server";
import spec from "../../../../openapi.json";
import pkg from "../../../../package.json";

// Serves the OpenAPI 3.1 spec. info.version is overridden with the live package
// version so the served spec never drifts from the running build.
export function GET() {
  return NextResponse.json({ ...spec, info: { ...spec.info, version: pkg.version } });
}
