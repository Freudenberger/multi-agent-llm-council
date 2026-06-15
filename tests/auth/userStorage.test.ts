import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { supabaseUserStorage } from "@/auth/supabaseUserStorage";

/**
 * The user storage factory selects its backend from DB_PROVIDER at import time,
 * mirroring the conversation storage factory. These tests reset the module
 * registry so each case re-evaluates the factory with a fresh env, without ever
 * touching the real data/users.json file. Because resetModules gives every
 * import a fresh instance, the factory result is compared against backends
 * imported from the SAME fresh registry rather than top-level imports.
 */
describe("userStorage factory (DB_PROVIDER)", () => {
  const original = process.env.DB_PROVIDER;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (original === undefined) delete process.env.DB_PROVIDER;
    else process.env.DB_PROVIDER = original;
  });

  async function loadFactory() {
    const [{ userStorage }, { localUserStorage }, { supabaseUserStorage }] =
      await Promise.all([
        import("@/auth/userStorage"),
        import("@/auth/localUserStorage"),
        import("@/auth/supabaseUserStorage"),
      ]);
    return { userStorage, localUserStorage, supabaseUserStorage };
  }

  it("defaults to local JSON storage when DB_PROVIDER is unset", async () => {
    delete process.env.DB_PROVIDER;
    const { userStorage, localUserStorage } = await loadFactory();
    expect(userStorage).toBe(localUserStorage);
  });

  it("uses local JSON storage when DB_PROVIDER=local", async () => {
    process.env.DB_PROVIDER = "local";
    const { userStorage, localUserStorage } = await loadFactory();
    expect(userStorage).toBe(localUserStorage);
  });

  it("uses Supabase storage when DB_PROVIDER=supabase", async () => {
    process.env.DB_PROVIDER = "supabase";
    const { userStorage, supabaseUserStorage } = await loadFactory();
    expect(userStorage).toBe(supabaseUserStorage);
  });

  it("falls back to local storage for an unknown provider", async () => {
    process.env.DB_PROVIDER = "mongodb";
    const { userStorage, localUserStorage } = await loadFactory();
    expect(userStorage).toBe(localUserStorage);
  });
});

describe("supabaseUserStorage without credentials", () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    if (url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = url;
    if (key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = key;
  });

  it("returns null on lookups instead of throwing", async () => {
    await expect(supabaseUserStorage.findById("user-x")).resolves.toBeNull();
    await expect(
      supabaseUserStorage.findByEmail("x@example.com"),
    ).resolves.toBeNull();
    await expect(supabaseUserStorage.getAll()).resolves.toEqual([]);
  });
});
