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

export type RunCouncilInput = {
  input: string;
  mode: CouncilModeId;
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
