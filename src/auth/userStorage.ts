import type { UserStorage } from "./types";
import { localUserStorage } from "./localUserStorage";
import { supabaseUserStorage } from "./supabaseUserStorage";

/**
 * User storage factory.
 *
 * Environment variable:
 *   DB_PROVIDER=local|supabase  (default: local)
 *
 * For Supabase, also set:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Mirrors the conversation storage factory in src/storage/index.ts so both
 * users and conversations follow the same DB_PROVIDER switch.
 */
function createUserStorage(): UserStorage {
  const provider = process.env.DB_PROVIDER || "local";

  switch (provider) {
    case "supabase":
      return supabaseUserStorage;
    case "local":
    default:
      return localUserStorage;
  }
}

export const userStorage: UserStorage = createUserStorage();
