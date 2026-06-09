import type { RunCouncilResult } from "../core/types";

/**
 * A stored conversation — the result of a council run plus metadata.
 */
export type StoredConversation = RunCouncilResult & {
  title: string;
};

/**
 * Summary for listing conversations (without full response content).
 */
export type ConversationSummary = {
  id: string;
  title: string;
  modeId: string;
  createdAt: string;
  messageCount: number;
};

/**
 * Storage provider interface.
 * Implementations: localStorage (JSON files) and supabaseStorage (PostgreSQL).
 */
export type StorageProvider = {
  /** List all conversations (newest first). */
  list(): Promise<ConversationSummary[]>;
  /** Get a single conversation by ID. */
  get(id: string): Promise<StoredConversation | null>;
  /** Save a new conversation. */
  save(conversation: StoredConversation): Promise<void>;
  /** Delete a conversation by ID. */
  delete(id: string): Promise<void>;
};
