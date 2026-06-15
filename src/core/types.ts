/** Core types for the Multi-Agent LLM Council */

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
  | { type: "agent_completed"; agentId: string; durationMs: number; ok: boolean };

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
