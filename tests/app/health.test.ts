import { describe, it, expect, afterEach } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  const original = {
    version: process.env.APP_VERSION,
    sha: process.env.GIT_SHA,
  };

  afterEach(() => {
    process.env.APP_VERSION = original.version;
    process.env.GIT_SHA = original.sha;
    if (original.version === undefined) delete process.env.APP_VERSION;
    if (original.sha === undefined) delete process.env.GIT_SHA;
  });

  it("returns an ok status with version, sha, and uptime", async () => {
    process.env.APP_VERSION = "9.9.9";
    process.env.GIT_SHA = "abc1234";

    const res = GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.version).toBe("9.9.9");
    expect(body.sha).toBe("abc1234");
    expect(typeof body.uptimeSeconds).toBe("number");
  });

  it("falls back to 'unknown' when build env vars are absent", async () => {
    delete process.env.APP_VERSION;
    delete process.env.GIT_SHA;

    const body = await GET().json();

    expect(body.version).toBe("unknown");
    expect(body.sha).toBe("unknown");
  });

  it("marks the response no-store so probes are never cached", () => {
    const res = GET();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
