import type { RunCouncilResult } from "../core/types";

/**
 * A stored conversation — the result of a council run plus metadata.
 */
export type StoredConversation = RunCouncilResult & {
  title: string;
  userId: string;
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
  /** List conversations for a user (newest first). */
  list(userId: string): Promise<ConversationSummary[]>;
  /** Get a single conversation by ID. */
  get(id: string): Promise<StoredConversation | null>;
  /** Save a new conversation. Enforces max conversations per user (deletes oldest). */
  save(conversation: StoredConversation): Promise<void>;
  /** Delete a conversation by ID. */
  delete(id: string): Promise<void>;
};
