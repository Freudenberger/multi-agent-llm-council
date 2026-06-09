import type { StorageProvider } from "./types";
import { localStorage } from "./localStorage";
import { supabaseStorage } from "./supabaseStorage";

/**
 * Storage provider factory.
 *
 * Environment variable:
 *   DB_PROVIDER=local|supabase  (default: local)
 *
 * For Supabase, also set:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */
export function createStorage(): StorageProvider {
  const provider = process.env.DB_PROVIDER || "local";

  switch (provider) {
    case "supabase":
      return supabaseStorage;
    case "local":
    default:
      return localStorage;
  }
}
