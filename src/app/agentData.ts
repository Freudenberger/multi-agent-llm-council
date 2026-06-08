import { agentTemplates } from "@/agents/defaultAgents";
import type { CouncilAgent } from "@/core/types";

/**
 * Maps mode IDs to their full agent definitions (including systemPrompt).
 * Used by the AgentCustomizer UI to show and edit agent data.
 */
const modeAgentIds: Record<string, string[]> = {
  decision: [
    "optimist",
    "sceptic",
    "risk-analyst",
    "pragmatist",
    "final-judge",
  ],
  idea: [
    "creative-thinker",
    "market-analyst",
    "technical-feasibility-reviewer",
    "user-perspective",
    "final-synthesizer",
  ],
  criticalReview: [
    "logic-reviewer",
    "clarity-reviewer",
    "evidence-reviewer",
    "sceptic",
    "final-editor",
  ],
  learning: [
    "teacher",
    "beginner",
    "examiner",
    "example-generator",
    "final-explainer",
  ],
  technical: [
    "software-architect",
    "security-reviewer",
    "performance-reviewer",
    "maintainability-reviewer",
    "final-recommender",
  ],
  answer: [
    "subject-matter-expert",
    "contrarian",
    "contextualizer",
    "synthesizer",
    "final-summarizer",
  ],
};

export function getModeAgents(modeId: string): CouncilAgent[] {
  const ids = modeAgentIds[modeId] ?? [];
  return ids.map((id) => {
    const t = agentTemplates.find((a) => a.id === id);
    if (!t) throw new Error(`Agent template "${id}" not found`);
    return {
      id: t.id,
      name: t.name,
      role: t.role,
      systemPrompt: t.perspective,
      isFinalJudge: t.isFinalJudge ?? false,
    };
  });
}

export type AgentTemplateInfo = CouncilAgent & {
  /** Which council mode(s) this agent originates from. */
  sourceModes: string[];
};

const MODE_NAMES: Record<string, string> = {
  decision: "Decision",
  idea: "Idea",
  criticalReview: "Critical Review",
  learning: "Learning",
  technical: "Technical",
  answer: "Answer",
};

/**
 * Returns every predefined agent across all council modes, deduplicated by id.
 * Used by the template picker so users can pick any agent from any council.
 */
export function getAllAgentTemplates(): AgentTemplateInfo[] {
  // First pass: collect which modes each agent id appears in
  const agentModes = new Map<string, string[]>();
  for (const [modeId, ids] of Object.entries(modeAgentIds)) {
    for (const id of ids) {
      const modes = agentModes.get(id) ?? [];
      modes.push(MODE_NAMES[modeId] ?? modeId);
      agentModes.set(id, modes);
    }
  }

  const seen = new Set<string>();
  const result: AgentTemplateInfo[] = [];
  for (const t of agentTemplates) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    result.push({
      id: t.id,
      name: t.name,
      role: t.role,
      systemPrompt: t.perspective,
      isFinalJudge: t.isFinalJudge ?? false,
      sourceModes: agentModes.get(t.id) ?? [],
    });
  }
  return result;
}
