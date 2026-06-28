import { describe, it, expect, vi, beforeEach } from "vitest";

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/auth/config", () => ({ auth }));

import { GET, POST } from "@/app/api/discussions/route";
import { NextRequest } from "next/server";

function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/discussions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const anon = () => auth.mockResolvedValue(null);
const signedIn = () => auth.mockResolvedValue({ user: { id: "u1" } });

describe("/api/discussions auth + validation", () => {
  beforeEach(() => auth.mockReset());

  it("GET rejects unauthenticated callers with 401", async () => {
    anon();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("POST rejects unauthenticated callers with 401 before parsing", async () => {
    anon();
    const res = await POST(post({ id: "d1", topic: "anything" }));
    expect(res.status).toBe(401);
  });

  it("POST rejects an invalid body with 400 (authenticated)", async () => {
    signedIn();
    // Missing required `topic`.
    const res = await POST(post({ id: "d1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid discussion");
    expect(body.details.topic).toBeDefined();
  });
});
