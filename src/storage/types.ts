import type {
  RunCouncilResult,
  DiscussionTurn,
  DiscussionSummary,
  CouncilAgentMeta,
} from "../core/types";

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

// ---------------------------------------------------------------------------
// Agent Roundtable discussions
// ---------------------------------------------------------------------------

export type DiscussionPhase =
  | "idle"
  | "running"
  | "done"
  | "cancelled"
  | "error"
  | "interrupted";

/** A persisted roundtable discussion (matches the `discussions` SQL table). */
export type StoredDiscussion = {
  id: string;
  userId: string;
  createdAt: string;
  topic: string;
  participants: CouncilAgentMeta[];
  rounds: number;
  turns: DiscussionTurn[];
  summary: DiscussionSummary | null;
  phase: DiscussionPhase;
};

/** Lightweight listing row for the history dropdown. */
export type DiscussionListItem = {
  id: string;
  topic: string;
  phase: DiscussionPhase;
  turnCount: number;
  createdAt: string;
};

/**
 * Discussion storage provider. `save` is an upsert (re-saving the same id
 * overwrites rather than duplicating); the cap only counts new discussions.
 */
export type DiscussionStorageProvider = {
  list(userId: string): Promise<DiscussionListItem[]>;
  get(id: string): Promise<StoredDiscussion | null>;
  save(discussion: StoredDiscussion): Promise<void>;
  delete(id: string): Promise<void>;
};
