import { describe, it, expect, afterEach } from "vitest";
import { GET } from "@/app/api/version/route";
import pkg from "../../package.json";

describe("GET /api/version", () => {
  const original = process.env.APP_VERSION;

  afterEach(() => {
    if (original === undefined) delete process.env.APP_VERSION;
    else process.env.APP_VERSION = original;
  });

  it("returns APP_VERSION when set", async () => {
    process.env.APP_VERSION = "9.9.9";
    const body = await GET().json();
    expect(body.version).toBe("9.9.9");
  });

  it("falls back to the package version when APP_VERSION is absent", async () => {
    delete process.env.APP_VERSION;
    const body = await GET().json();
    expect(body.version).toBe(pkg.version);
  });

  it("reports mockMode based on LLM_PROVIDER (default mock)", async () => {
    const orig = process.env.LLM_PROVIDER;
    try {
      delete process.env.LLM_PROVIDER;
      expect((await GET().json()).mockMode).toBe(true);
      process.env.LLM_PROVIDER = "openrouter";
      expect((await GET().json()).mockMode).toBe(false);
    } finally {
      if (orig === undefined) delete process.env.LLM_PROVIDER;
      else process.env.LLM_PROVIDER = orig;
    }
  });
});
