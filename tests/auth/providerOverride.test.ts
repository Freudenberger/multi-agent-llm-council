import { describe, it, expect } from "vitest";
import { resolveProviderOverride } from "@/auth/providerOverride";

describe("resolveProviderOverride", () => {
  it("returns undefined when the user has no provider settings", () => {
    expect(resolveProviderOverride(undefined)).toBeUndefined();
    expect(resolveProviderOverride({})).toBeUndefined();
  });

  it("returns the provider id + key for a configured provider", () => {
    expect(
      resolveProviderOverride({ openrouter: { apiKey: "sk-abc" } }),
    ).toEqual({ providerId: "openrouter", apiKey: "sk-abc" });
  });

  it("treats an empty / whitespace key as not configured", () => {
    expect(resolveProviderOverride({ openrouter: { apiKey: "" } })).toBeUndefined();
    expect(
      resolveProviderOverride({ openrouter: { apiKey: "   " } }),
    ).toBeUndefined();
  });

  it("picks the first provider that has a non-empty key", () => {
    const result = resolveProviderOverride({
      openrouter: { apiKey: "" },
      "future-provider": { apiKey: "sk-future" },
    });
    expect(result).toEqual({ providerId: "future-provider", apiKey: "sk-future" });
  });
});
