import fs from "node:fs";
import path from "node:path";
import type {
  DiscussionStorageProvider,
  StoredDiscussion,
  DiscussionListItem,
} from "./types";
import { logger } from "../core/logger";
import { MAX_DISCUSSIONS_PER_USER } from "../config";

/**
 * Storage for Agent Roundtable discussions. Mirrors the council conversation
 * storage: a local JSON-file provider (default) and a Supabase provider,
 * selected by DB_PROVIDER. `save` upserts by id.
 */

// ---------------------------------------------------------------------------
// Local JSON file provider
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data", "discussions");

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(id: string): string {
  return path.join(DATA_DIR, `${id}.json`);
}

function toListItem(d: StoredDiscussion): DiscussionListItem {
  return {
    id: d.id,
    topic: d.topic,
    phase: d.phase,
    turnCount: d.turns.length,
    createdAt: d.createdAt,
  };
}

const localDiscussionStorage: DiscussionStorageProvider = {
  async list(userId: string): Promise<DiscussionListItem[]> {
    ensureDir();
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
    const items: DiscussionListItem[] = [];
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
        const d: StoredDiscussion = JSON.parse(raw);
        if (d.userId !== userId) continue;
        items.push(toListItem(d));
      } catch {
        logger.debug("Skipping corrupt discussion file", { file });
      }
    }
    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return items;
  },

  async get(id: string): Promise<StoredDiscussion | null> {
    const fp = filePath(id);
    if (!fs.existsSync(fp)) return null;
    try {
      return JSON.parse(fs.readFileSync(fp, "utf-8")) as StoredDiscussion;
    } catch {
      logger.error("Failed to read discussion", { id });
      return null;
    }
  },

  async getOwned(id: string, userId: string): Promise<StoredDiscussion | null> {
    const d = await this.get(id);
    return d && d.userId === userId ? d : null;
  },

  async save(discussion: StoredDiscussion): Promise<void> {
    ensureDir();
    const fp = filePath(discussion.id);
    // Only enforce the cap for genuinely new discussions; re-saving an
    // existing id is an in-place update.
    if (!fs.existsSync(fp)) {
      const existing = await this.list(discussion.userId);
      if (existing.length >= MAX_DISCUSSIONS_PER_USER) {
        const oldest = existing[existing.length - 1];
        await this.delete(oldest.id);
      }
    }
    fs.writeFileSync(fp, JSON.stringify(discussion, null, 2), "utf-8");
    logger.debug("Discussion saved", { id: discussion.id, userId: discussion.userId });
  },

  async delete(id: string): Promise<void> {
    const fp = filePath(id);
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
      logger.debug("Discussion deleted", { id });
    }
  },
};

// ---------------------------------------------------------------------------
// Supabase provider
// ---------------------------------------------------------------------------

type SupabaseQueryResult = { data: unknown; error: { message: string } | null };

type SupabaseQueryBuilder = {
  order: (column: string, opts: { ascending: boolean }) => Promise<SupabaseQueryResult>;
  eq: (column: string, value: string) => SupabaseQueryBuilder;
  single: () => Promise<SupabaseQueryResult>;
};

type SupabaseClient = {
  from: (table: string) => {
    select: (columns: string) => SupabaseQueryBuilder;
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
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

function rowToDiscussion(row: Record<string, unknown>): StoredDiscussion {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    createdAt: row.created_at as string,
    topic: (row.topic as string) ?? "",
    participants: (row.participants as StoredDiscussion["participants"]) ?? [],
    rounds: (row.rounds as number) ?? 0,
    turns: (row.turns as StoredDiscussion["turns"]) ?? [],
    summary: (row.summary as StoredDiscussion["summary"]) ?? null,
    phase: (row.phase as StoredDiscussion["phase"]) ?? "done",
  };
}

const supabaseDiscussionStorage: DiscussionStorageProvider = {
  async list(userId: string): Promise<DiscussionListItem[]> {
    const c = getClient();
    if (!c) return [];
    // Select turns too so turnCount is accurate; capped at a handful of rows.
    const { data, error } = await c
      .from("discussions")
      .select("id, topic, phase, turns, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      logger.error("Supabase discussion list failed", { error: error.message });
      return [];
    }
    return ((data as unknown[]) || []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        topic: (r.topic as string) ?? "",
        phase: (r.phase as DiscussionListItem["phase"]) ?? "done",
        turnCount: Array.isArray(r.turns) ? r.turns.length : 0,
        createdAt: r.created_at as string,
      };
    });
  },

  async get(id: string): Promise<StoredDiscussion | null> {
    const c = getClient();
    if (!c) return null;
    const { data, error } = await c
      .from("discussions")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      logger.error("Supabase discussion get failed", { id, error: error.message });
      return null;
    }
    return rowToDiscussion(data as Record<string, unknown>);
  },

  async getOwned(id: string, userId: string): Promise<StoredDiscussion | null> {
    const d = await this.get(id);
    return d && d.userId === userId ? d : null;
  },

  async save(discussion: StoredDiscussion): Promise<void> {
    const c = getClient();
    if (!c) throw new Error("Supabase client not available");

    const existing = await this.get(discussion.id);
    if (!existing) {
      const userDiscussions = await this.list(discussion.userId);
      if (userDiscussions.length >= MAX_DISCUSSIONS_PER_USER) {
        await this.delete(userDiscussions[userDiscussions.length - 1].id);
      }
    } else {
      // Upsert: remove the old row before re-inserting.
      await this.delete(discussion.id);
    }

    const row = {
      id: discussion.id,
      user_id: discussion.userId,
      topic: discussion.topic,
      participants: discussion.participants,
      rounds: discussion.rounds,
      turns: discussion.turns,
      summary: discussion.summary,
      phase: discussion.phase,
      created_at: discussion.createdAt,
    };
    const { error } = await c.from("discussions").insert(row);
    if (error) {
      logger.error("Supabase discussion save failed", { id: discussion.id, error: error.message });
      throw new Error(`Failed to save discussion: ${error.message}`);
    }
  },

  async delete(id: string): Promise<void> {
    const c = getClient();
    if (!c) throw new Error("Supabase client not available");
    const { error } = await c.from("discussions").delete().eq("id", id);
    if (error) {
      logger.error("Supabase discussion delete failed", { id, error: error.message });
      throw new Error(`Failed to delete discussion: ${error.message}`);
    }
  },
};

/** DB_PROVIDER=local|supabase (default: local). */
export function createDiscussionStorage(): DiscussionStorageProvider {
  return process.env.DB_PROVIDER === "supabase"
    ? supabaseDiscussionStorage
    : localDiscussionStorage;
}
