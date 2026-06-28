import { describe, it, expect, vi, beforeEach } from "vitest";

// auth() and userStorage are resolved per-request; mock both so we can flip
// between authenticated and anonymous without a real session.
const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/auth/config", () => ({ auth }));
vi.mock("@/auth/userStorage", () => ({
  userStorage: { findById: vi.fn(async () => ({ id: "u1", preferredModels: undefined })) },
}));

import { POST, GET } from "@/app/api/discuss/route";
import { NextRequest } from "next/server";

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/discuss", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function readNdjson(res: Response) {
  return (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { kind: string; [k: string]: unknown });
}

const signedIn = () => auth.mockResolvedValue({ user: { id: "u1" } });
const anon = () => auth.mockResolvedValue(null);

describe("POST /api/discuss", () => {
  beforeEach(() => auth.mockReset());

  it("rejects non-JSON bodies with 400 before touching auth", async () => {
    const res = await POST(req("{bad"));
    expect(res.status).toBe(400);
    expect((await res.json()).type).toBe("validation");
  });

  it("rejects a body that fails the schema with 400", async () => {
    signedIn();
    // Only one agent — below DISCUSSION_MIN_AGENTS.
    const res = await POST(req({ topic: "AI ethics", agentIds: ["optimist"], rounds: 1 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.type).toBe("validation");
    expect(body.details.agentIds).toBeDefined();
  });

  it("requires authentication once the body is valid", async () => {
    anon();
    const res = await POST(
      req({ topic: "AI ethics", agentIds: ["optimist", "sceptic"], rounds: 1 }),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).type).toBe("unauthorized");
  });

  it("streams a roundtable result for an authenticated, valid request", async () => {
    signedIn();
    const res = await POST(
      req({ topic: "Should we adopt a 4-day week?", agentIds: ["optimist", "sceptic"], rounds: 1 }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("x-ndjson");

    const lines = await readNdjson(res);
    expect(lines.some((l) => l.kind === "progress")).toBe(true);
    const result = lines.find((l) => l.kind === "result");
    expect(result).toBeDefined();
    const run = result!.result as { turns: unknown[]; rounds: number };
    expect(run.turns.length).toBeGreaterThan(0);
    expect(run.rounds).toBe(1);
  }, 30000);
});

describe("GET /api/discuss", () => {
  it("is method-not-allowed", async () => {
    expect((await GET()).status).toBe(405);
  });
});
