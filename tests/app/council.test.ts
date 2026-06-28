import { describe, it, expect, vi } from "vitest";

// Unauthenticated by default: keeps the happy path off the storage branch so
// the test exercises pure orchestration with the mock provider.
vi.mock("@/auth/config", () => ({ auth: vi.fn(async () => null) }));

import { POST, GET } from "@/app/api/council/route";
import { NextRequest } from "next/server";

let ip = 0;
/** Build a POST request with a unique client IP so rate-limit state never leaks between tests. */
function req(body: unknown): NextRequest {
  ip++;
  return new NextRequest("http://localhost/api/council", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.0.0.${ip}`,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Collect an NDJSON Response stream into an array of parsed objects. */
async function readNdjson(res: Response): Promise<Array<{ kind: string; [k: string]: unknown }>> {
  const text = await res.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe("POST /api/council", () => {
  it("rejects non-JSON bodies with 400", async () => {
    const res = await POST(req("not json{"));
    expect(res.status).toBe(400);
    expect((await res.json()).type).toBe("validation");
  });

  it("rejects an invalid mode with a 400 validation error", async () => {
    const res = await POST(req({ input: "hi", mode: "bogus" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.type).toBe("validation");
    expect(body.details.mode).toBeDefined();
  });

  it("rejects empty input with a 400 validation error", async () => {
    const res = await POST(req({ input: "", mode: "decision" }));
    expect(res.status).toBe(400);
    expect((await res.json()).type).toBe("validation");
  });

  it("streams progress and a final result for a valid run", async () => {
    const res = await POST(req({ input: "Should we ship?", mode: "decision" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("x-ndjson");

    const lines = await readNdjson(res);
    expect(lines.some((l) => l.kind === "progress")).toBe(true);

    const result = lines.find((l) => l.kind === "result");
    expect(result).toBeDefined();
    const run = result!.result as { modeId: string; finalReport: { confidence: number } };
    expect(run.modeId).toBe("decision");
    expect(run.finalReport.confidence).toBeGreaterThanOrEqual(1);
  }, 30000);

  it("rate-limits a client that exceeds the window", async () => {
    // Reuse one IP across the burst so all calls share a rate-limit bucket.
    const burstIp = "172.16.99.99";
    const makeReq = () =>
      new NextRequest("http://localhost/api/council", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": burstIp },
        body: JSON.stringify({ input: "", mode: "decision" }), // 400s fast, no provider work
      });

    let limited: Response | undefined;
    for (let i = 0; i < 25; i++) {
      const res = await POST(makeReq());
      if (res.status === 429) {
        limited = res;
        break;
      }
    }
    expect(limited, "expected a 429 within the burst").toBeDefined();
    expect(limited!.headers.get("retry-after")).toBeTruthy();
    expect((await limited!.json()).type).toBe("rate_limited");
  });
});

describe("GET /api/council", () => {
  it("is method-not-allowed", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });
});
