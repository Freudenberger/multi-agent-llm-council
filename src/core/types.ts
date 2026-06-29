/** Core types for the Multi-Agent LLM Council */

import type { ProviderOverride, TokenUsage } from "../providers/types";

export type CouncilModeId =
  | "decision"
  | "idea"
  | "criticalReview"
  | "learning"
  | "technical"
  | "answer"
  | "swot";

export type CouncilAgent = {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  /** If true, this agent runs after all specialists have completed. */
  isFinalJudge?: boolean;
  /** If true, this agent is excluded from the council run. Defaults to false. */
  disabled?: boolean;
  /** OpenRouter model identifier for this agent, e.g. "openrouter/free". */
  model?: string;
};

export type CouncilMode = {
  id: CouncilModeId;
  name: string;
  description: string;
  agents: CouncilAgent[];
};

/**
 * Returns only the specialist agents (non-judge) for a mode.
 */
export function getSpecialists(mode: CouncilMode): CouncilAgent[] {
  return mode.agents.filter((a) => !a.isFinalJudge);
}

/**
 * Returns the final judge agent for a mode, if any.
 */
export function getFinalJudge(mode: CouncilMode): CouncilAgent | undefined {
  return mode.agents.find((a) => a.isFinalJudge);
}

export type AgentResponse = {
  agentId: string;
  agentName: string;
  content: string;
  confidence: number;
  /**
   * Resolved model that produced this response (e.g. "mock-provider"). Optional
   * for backward compatibility with conversations saved before models were
   * recorded.
   */
  model?: string;
  /** Provider-reported token usage for this response when available. */
  usage?: TokenUsage;
};

export type FinalReport = {
  summary: string;
  keyConclusions: string[];
  agreements: string[];
  disagreements: string[];
  risks: string[];
  recommendations: string[];
  confidence: number;
};

export type CouncilRun = {
  id: string;
  modeId: CouncilModeId;
  userInput: string;
  agentResponses: AgentResponse[];
  /** Peer-review/ranking evaluations, present only for peer-review modes. */
  peerReviews?: AgentResponse[];
  finalReport: FinalReport;
  createdAt: string;
};

/** User-provided agent override — only name/role/prompt can be customized. */
export type CustomAgent = {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  isFinalJudge?: boolean;
  /** If true, this agent is excluded from the council run. Defaults to false. */
  disabled?: boolean;
  /** OpenRouter model identifier for this agent, e.g. "openrouter/free" or "anthropic/claude-sonnet-4-20250514". */
  model?: string;
};

export type RunCouncilInput = {
  input: string;
  mode: CouncilModeId;
  /** Optional per-agent overrides keyed by agent id. */
  customAgents?: Record<string, CustomAgent>;
  /**
   * Optional user-level model allow-list. Every agent that has no explicit
   * `model` (neither from its template nor a customAgents override) is assigned
   * a model picked at random from this list. Sourced from the user's preferred
   * models. When empty/omitted, those agents use the provider default.
   */
  fallbackModels?: string[];
  /**
   * Optional bring-your-own-key provider override — typically the signed-in
   * user's own API key plus the provider it belongs to. When provided, every
   * provider call in this run uses that provider with the user's key, overriding
   * the env `LLM_PROVIDER` (so a user with their own key gets live LLMs even on a
   * `mock` demo instance). When omitted, the env-configured provider is used.
   */
  providerOverride?: ProviderOverride;
  /**
   * When true, the orchestrator inserts a peer-review/ranking phase between the
   * specialists and the judge: each specialist evaluates the other (anonymized)
   * responses and ranks them, and those evaluations are handed to the judge.
   * Per-run and optional — when omitted/false the run uses the default
   * two-phase flow. This is a run-level analysis option, not a mode.
   */
  peerReview?: boolean;
  /**
   * Optional caller-supplied run id used to correlate logs across the whole
   * request (e.g. the API route generates one and passes it in). When omitted,
   * runCouncil generates its own. The value also becomes the result id.
   */
  runId?: string;
  /**
   * Optional callback invoked as the run progresses (run start, phase changes,
   * per-agent start/finish). Used to stream live status to the client.
   */
  onProgress?: (event: CouncilProgressEvent) => void;
  /**
   * Optional abort signal. When it fires, in-flight provider calls are aborted
   * and the run stops at the next phase boundary, throwing `CouncilAbortedError`.
   */
  signal?: AbortSignal;
};

/** Lightweight description of an agent, used in progress events. */
export type CouncilAgentMeta = {
  id: string;
  name: string;
  role: string;
  isFinalJudge: boolean;
};

/**
 * Progress events emitted by `runCouncil` via `onProgress`. The API route
 * serializes these to the client so the UI can show live per-agent status.
 */
export type CouncilProgressEvent =
  | {
      type: "run_started";
      specialists: CouncilAgentMeta[];
      judge: CouncilAgentMeta | null;
    }
  | { type: "phase_started"; phase: "specialists" | "peer-review" | "judge" }
  | { type: "agent_started"; agentId: string }
  | {
      type: "agent_completed";
      agentId: string;
      durationMs: number;
      ok: boolean;
    };

export type RunCouncilResult = {
  id: string;
  modeId: CouncilModeId;
  userInput: string;
  /** All specialist agent responses. */
  agentResponses: AgentResponse[];
  /**
   * Per-specialist peer-review/ranking evaluations of the anonymized responses.
   * Present (non-empty) only when the mode enables the peer-review phase.
   */
  peerReviews?: AgentResponse[];
  /** The final judge's raw evaluation (for transparency). */
  judgeResponse: AgentResponse | null;
  finalReport: FinalReport;
  createdAt: string;
};

// ─── Discussion (live roundtable) ───────────────────────────────────
//
// A separate orchestration from the council: instead of specialists answering
// in parallel and a judge synthesizing, a small panel of agents talks
// back-and-forth in turns. Each agent sees the full transcript so far and
// reacts to it. The loop is bounded by `rounds` — the number of times each
// agent speaks. Powers the hidden /discuss page.

/** Inclusive bounds on the live-discussion panel size. */
export const DISCUSSION_MIN_AGENTS = 2;
export const DISCUSSION_MAX_AGENTS = 4;
/** Inclusive bounds on how many times each agent speaks (the loop limit). */
export const DISCUSSION_MIN_ROUNDS = 1;
export const DISCUSSION_MAX_ROUNDS = 6;

/** The closing summary produced by the optional summarizer agent. */
export type DiscussionSummary = {
  agentId: string;
  agentName: string;
  content: string;
  /** Resolved model that produced the summary (e.g. "mock-provider"). */
  model: string;
  /** False when the summarizer failed and `content` is a placeholder. */
  ok: boolean;
  /** Provider-reported token usage for this summary when available. */
  usage?: TokenUsage;
};

/** One agent's contribution at a point in the discussion. */
export type DiscussionTurn = {
  /** 1-based round number (each round, every agent speaks once). */
  round: number;
  /** 0-based position across the whole discussion. */
  index: number;
  agentId: string;
  agentName: string;
  content: string;
  /** Resolved model that produced this turn (e.g. "mock-provider"). */
  model: string;
  /** False when the agent's turn failed and `content` is a placeholder. */
  ok: boolean;
  /** Provider-reported token usage for this turn when available. */
  usage?: TokenUsage;
};

export type RunDiscussionInput = {
  /** The question/topic the panel discusses. */
  topic: string;
  /** Ordered participant agent-template ids (2-4, distinct). */
  agentIds: string[];
  /** How many times each agent speaks — the loop limit (1-6). */
  rounds: number;
  /**
   * Optional agent-template id that summarizes the whole discussion after the
   * rounds finish. When omitted, no summary is produced.
   */
  summarizerId?: string;
  /**
   * Optional user-level model allow-list. Each participant without an explicit
   * model is assigned one at random from this list (stable for the whole run).
   */
  fallbackModels?: string[];
  /**
   * Optional bring-your-own-key provider override (the user's own key + its
   * provider id). When provided, the discussion uses that provider with the
   * user's key, overriding `LLM_PROVIDER`.
   */
  providerOverride?: ProviderOverride;
  /** Optional caller-supplied run id; also becomes the result id. */
  runId?: string;
  /** Optional callback invoked as the discussion progresses. */
  onProgress?: (event: DiscussionProgressEvent) => void;
  /** Optional abort signal — stops the discussion at the next turn boundary. */
  signal?: AbortSignal;
};

/**
 * Progress events emitted by `runDiscussion` via `onProgress`. The API route
 * serializes these to the client so the UI can render the conversation live.
 */
export type DiscussionProgressEvent =
  | {
      type: "discussion_started";
      participants: CouncilAgentMeta[];
      rounds: number;
    }
  | { type: "round_started"; round: number }
  | { type: "turn_started"; round: number; agentId: string }
  | { type: "turn_completed"; turn: DiscussionTurn; durationMs: number }
  | { type: "summary_started"; agentId: string }
  | {
      type: "summary_completed";
      summary: DiscussionSummary;
      durationMs: number;
    };

export type RunDiscussionResult = {
  id: string;
  topic: string;
  participants: CouncilAgentMeta[];
  rounds: number;
  turns: DiscussionTurn[];
  /** Present only when a summarizer was selected for the run. */
  summary?: DiscussionSummary;
  createdAt: string;
};
