import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/models/route";

// Each test imports a fresh module so the route's in-memory cache (module-level
// `cachedModels`) doesn't bleed across cases.
async function freshGET() {
  vi.resetModules();
  return (await import("@/app/api/models/route")).GET;
}

describe("GET /api/models", () => {
  const originalKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  });

  it("returns an empty list (no fetch) when no API key is configured", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const get = await freshGET();
    const body = await (await get()).json();

    expect(body.models).toEqual([]);
    expect(body.cached).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("filters to free models, derives a short name, and sorts by id", async () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            { id: "z/paid", pricing: { prompt: "0.01", completion: "0" } },
            { id: "vendor/free-model", pricing: { prompt: "0", completion: "0" }, context_length: 8000 },
            { id: "a/another-free", pricing: { prompt: "0", completion: "0" } },
          ],
        }),
      })),
    );

    const get = await freshGET();
    const body = await (await get()).json();

    expect(body.models.map((m: { id: string }) => m.id)).toEqual([
      "a/another-free",
      "vendor/free-model",
    ]); // paid filtered out, sorted by id
    expect(body.models[1].name).toBe("free-model"); // last path segment
    expect(body.models[1].free).toBe(true);
  });

  it("returns 502 when the upstream responds non-ok", async () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));

    const get = await freshGET();
    const res = await get();
    expect(res.status).toBe(502);
    expect((await res.json()).models).toEqual([]);
  });

  it("returns 500 when the upstream fetch throws", async () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));

    const get = await freshGET();
    const res = await get();
    expect(res.status).toBe(500);
  });
});
