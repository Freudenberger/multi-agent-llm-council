import type {
  StorageProvider,
  StoredConversation,
  ConversationSummary,
} from "./types";
import type { CouncilModeId } from "../core/types";
import { logger } from "../core/logger";

/**
 * Supabase storage provider — stores conversations in PostgreSQL.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.
 *
 * Expected table schema:
 *
 *   CREATE TABLE conversations (
 *     id          TEXT PRIMARY KEY,
 *     title       TEXT NOT NULL,
 *     mode_id     TEXT NOT NULL,
 *     user_input  TEXT NOT NULL,
 *     agent_responses JSONB NOT NULL DEFAULT '[]',
 *     judge_response  JSONB,
 *     final_report    JSONB NOT NULL DEFAULT '{}',
 *     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 */

type SupabaseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      order: (
        column: string,
        opts: { ascending: boolean },
      ) => Promise<{
        data: unknown[] | null;
        error: { message: string } | null;
      }>;
      eq: (
        column: string,
        value: string,
      ) => Promise<{
        data: unknown[] | null;
        error: { message: string } | null;
      }>;
    };
    insert: (
      row: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
    delete: () => {
      eq: (
        column: string,
        value: string,
      ) => Promise<{ error: { message: string } | null }>;
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

  // Dynamic import so the app doesn't crash if @supabase/supabase-js is not installed
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

function rowToSummary(row: Record<string, unknown>): ConversationSummary {
  return {
    id: row.id as string,
    title: (row.title as string) || "Untitled",
    modeId: row.mode_id as string,
    createdAt: row.created_at as string,
    messageCount: 1,
  };
}

function rowToConversation(row: Record<string, unknown>): StoredConversation {
  return {
    id: row.id as string,
    modeId: row.mode_id as string as CouncilModeId,
    userInput: row.user_input as string,
    agentResponses:
      (row.agent_responses as StoredConversation["agentResponses"]) || [],
    judgeResponse:
      (row.judge_response as StoredConversation["judgeResponse"]) || null,
    finalReport: (row.final_report as StoredConversation["finalReport"]) || {
      summary: "",
      keyConclusions: [],
      agreements: [],
      disagreements: [],
      risks: [],
      recommendations: [],
      confidence: 3,
    },
    createdAt: row.created_at as string,
    title: (row.title as string) || "Untitled",
  };
}

export const supabaseStorage: StorageProvider = {
  async list(): Promise<ConversationSummary[]> {
    const c = getClient();
    if (!c) return [];

    const { data, error } = await c
      .from("conversations")
      .select("id, title, mode_id, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Supabase list failed", { error: error.message });
      return [];
    }

    return (data || []).map((row) =>
      rowToSummary(row as Record<string, unknown>),
    );
  },

  async get(id: string): Promise<StoredConversation | null> {
    const c = getClient();
    if (!c) return null;

    const { data, error } = await c
      .from("conversations")
      .select("*")
      .eq("id", id);

    if (error) {
      logger.error("Supabase get failed", { id, error: error.message });
      return null;
    }

    const rows = data || [];
    if (rows.length === 0) return null;
    return rowToConversation(rows[0] as Record<string, unknown>);
  },

  async save(conversation: StoredConversation): Promise<void> {
    const c = getClient();
    if (!c) throw new Error("Supabase client not available");

    const row = {
      id: conversation.id,
      title: conversation.title,
      mode_id: conversation.modeId,
      user_input: conversation.userInput,
      agent_responses: conversation.agentResponses,
      judge_response: conversation.judgeResponse,
      final_report: conversation.finalReport,
      created_at: conversation.createdAt,
    };

    const { error } = await c.from("conversations").insert(row);
    if (error) {
      logger.error("Supabase save failed", {
        id: conversation.id,
        error: error.message,
      });
      throw new Error(`Failed to save conversation: ${error.message}`);
    }
  },

  async delete(id: string): Promise<void> {
    const c = getClient();
    if (!c) throw new Error("Supabase client not available");

    const { error } = await c.from("conversations").delete().eq("id", id);
    if (error) {
      logger.error("Supabase delete failed", { id, error: error.message });
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }
  },
};
