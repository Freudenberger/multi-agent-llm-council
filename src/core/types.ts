/** Core types for the Multi-Agent LLM Council */

export type CouncilModeId =
  | "decision"
  | "idea"
  | "criticalReview"
  | "learning"
  | "technical"
  | "answer";

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
   * Optional caller-supplied run id used to correlate logs across the whole
   * request (e.g. the API route generates one and passes it in). When omitted,
   * runCouncil generates its own. The value also becomes the result id.
   */
  runId?: string;
};

export type RunCouncilResult = {
  id: string;
  modeId: CouncilModeId;
  userInput: string;
  /** All specialist agent responses. */
  agentResponses: AgentResponse[];
  /** The final judge's raw evaluation (for transparency). */
  judgeResponse: AgentResponse | null;
  finalReport: FinalReport;
  createdAt: string;
};
