import type { User, ProviderSettings, UserStorage } from "./types";
import { logger } from "../core/logger";

/**
 * Supabase user storage provider — stores users in PostgreSQL.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.
 *
 * Expected table schema (see supabase/schema.sql):
 *
 *   CREATE TABLE users (
 *     id               TEXT PRIMARY KEY,
 *     email            TEXT NOT NULL,
 *     name             TEXT NOT NULL,
 *     password_hash    TEXT NOT NULL,
 *     provider_settings JSONB NOT NULL DEFAULT '{}',
 *     preferred_models  JSONB NOT NULL DEFAULT '[]',
 *     created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 *   CREATE UNIQUE INDEX idx_users_email ON users (lower(email));
 */

type QueryResult = { data: unknown; error: { message: string } | null };
type MutationResult = { error: { message: string } | null };

type FilterBuilder = {
  eq: (column: string, value: string) => FilterBuilder;
  single: () => Promise<QueryResult>;
  then: <TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: (value: QueryResult) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
  ) => Promise<TResult1 | TResult2>;
};

type SupabaseClient = {
  from: (table: string) => {
    select: (columns: string) => FilterBuilder;
    insert: (row: Record<string, unknown>) => Promise<MutationResult>;
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<MutationResult>;
    };
  };
};

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    logger.error("Supabase credentials not configured");
    return null;
  }

  // Dynamic import so the app doesn't crash if @supabase/supabase-js is absent.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require("@supabase/supabase-js") as {
      createClient: (url: string, key: string) => SupabaseClient;
    };
    client = createClient(url, key);
    return client;
  } catch {
    logger.error(
      "Failed to create Supabase client. Install @supabase/supabase-js: npm install @supabase/supabase-js",
    );
    return null;
  }
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    passwordHash: row.password_hash as string,
    createdAt: row.created_at as string,
    providerSettings:
      (row.provider_settings as ProviderSettings | null) ?? undefined,
    preferredModels: (row.preferred_models as string[] | null) ?? undefined,
  };
}

async function fetchOne(
  column: string,
  value: string,
): Promise<User | null> {
  const c = getClient();
  if (!c) return null;

  const { data, error } = await c
    .from("users")
    .select("*")
    .eq(column, value)
    .single();

  if (error) {
    // "no rows" is an expected miss, not an error worth logging loudly.
    if (!/no rows|0 rows|PGRST116/i.test(error.message)) {
      logger.error("Supabase user lookup failed", {
        column,
        error: error.message,
      });
    }
    return null;
  }
  if (!data) return null;
  return rowToUser(data as Record<string, unknown>);
}

export const supabaseUserStorage: UserStorage = {
  async findByEmail(email: string): Promise<User | null> {
    return fetchOne("email", email.toLowerCase());
  },

  async findById(id: string): Promise<User | null> {
    return fetchOne("id", id);
  },

  async create(user: User): Promise<void> {
    const c = getClient();
    if (!c) throw new Error("Supabase client not available");

    const row = {
      id: user.id,
      email: user.email.toLowerCase(),
      name: user.name,
      password_hash: user.passwordHash,
      provider_settings: user.providerSettings ?? {},
      preferred_models: user.preferredModels ?? [],
      created_at: user.createdAt,
    };

    const { error } = await c.from("users").insert(row);
    if (error) {
      logger.error("Supabase user create failed", {
        id: user.id,
        error: error.message,
      });
      throw new Error(`Failed to create user: ${error.message}`);
    }
    logger.info("User created", { id: user.id, email: user.email });
  },

  async getAll(): Promise<User[]> {
    const c = getClient();
    if (!c) return [];

    const { data, error } = await c.from("users").select("*");
    if (error) {
      logger.error("Supabase user list failed", { error: error.message });
      return [];
    }
    return ((data as unknown[]) || []).map((row) =>
      rowToUser(row as Record<string, unknown>),
    );
  },

  async updateProviderSettings(
    userId: string,
    providerSettings: ProviderSettings,
  ): Promise<User | null> {
    const c = getClient();
    if (!c) throw new Error("Supabase client not available");

    const { error } = await c
      .from("users")
      .update({ provider_settings: providerSettings })
      .eq("id", userId);
    if (error) {
      logger.error("Supabase update provider settings failed", {
        userId,
        error: error.message,
      });
      return null;
    }
    logger.info("User provider settings updated", { userId });
    return this.findById(userId);
  },

  async updatePreferredModels(
    userId: string,
    preferredModels: string[],
  ): Promise<User | null> {
    const c = getClient();
    if (!c) throw new Error("Supabase client not available");

    const { error } = await c
      .from("users")
      .update({ preferred_models: preferredModels })
      .eq("id", userId);
    if (error) {
      logger.error("Supabase update preferred models failed", {
        userId,
        error: error.message,
      });
      return null;
    }
    logger.info("User preferred models updated", {
      userId,
      count: preferredModels.length,
    });
    return this.findById(userId);
  },
};
