import { NextRequest, NextResponse } from "next/server";
import { renderMetrics, snapshotMetrics } from "@/core/metrics";

// Prometheus scrape target. Like /health, it's auth-independent and touches no
// DB or provider — just dumps the in-process counters. Never cache: a scrape
// must see live values.
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  // Optionally gate behind a static bearer token (set METRICS_TOKEN and
  // configure the scraper with `authorization: Bearer <token>`). Left open if
  // unset, matching /health.
  // ponytail: static-token check, not a full auth layer — that's all a
  // Prometheus scraper needs.
  const token = process.env.METRICS_TOKEN;
  if (token && request.headers.get("authorization") !== `Bearer ${token}`) {
    return new Response("Unauthorized\n", { status: 401 });
  }

  // `?format=json` feeds the in-app /metrics viewer; default stays Prometheus
  // text so existing scrapers are unaffected.
  if (request.nextUrl.searchParams.get("format") === "json") {
    return NextResponse.json(snapshotMetrics(), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new Response(renderMetrics(), {
    headers: {
      "Content-Type": "text/plain; version=0.0.4",
      "Cache-Control": "no-store",
    },
  });
}
