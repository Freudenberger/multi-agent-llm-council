import type { CouncilMode, CouncilModeId } from "../core/types";
import { agentTemplates } from "../agents/defaultAgents";

function buildAgents(...ids: string[]) {
  return ids.map((id) => {
    const template = agentTemplates.find((a: { id: string }) => a.id === id);
    if (!template) throw new Error(`Agent template "${id}" not found`);
    return {
      id: template.id,
      name: template.name,
      role: template.role,
      systemPrompt: template.perspective,
      isFinalJudge: template.isFinalJudge ?? false,
    };
  });
}

export const councilModes: Record<CouncilModeId, CouncilMode> = {
  decision: {
    id: "decision",
    name: "Decision Council",
    description:
      "Analyzes a decision from multiple perspectives: optimistic, sceptical, risk-focused, pragmatic, and a final judgment.",
    agents: buildAgents(
      "optimist",
      "sceptic",
      "risk-analyst",
      "pragmatist",
      "final-judge",
    ),
  },
  idea: {
    id: "idea",
    name: "Idea Council",
    description:
      "Evaluates an idea from creative, market, technical, user, and synthesis perspectives.",
    agents: buildAgents(
      "creative-thinker",
      "market-analyst",
      "technical-feasibility-reviewer",
      "user-perspective",
      "final-synthesizer",
    ),
  },
  criticalReview: {
    id: "criticalReview",
    name: "Critical Review Council",
    description:
      "Reviews text, arguments, or proposals for logic, clarity, evidence, and overall quality.",
    agents: buildAgents(
      "logic-reviewer",
      "clarity-reviewer",
      "evidence-reviewer",
      "sceptic",
      "final-editor",
    ),
  },
  learning: {
    id: "learning",
    name: "Learning Council",
    description:
      "Explains concepts through teaching, questions, examples, and comprehensive summaries.",
    agents: buildAgents(
      "teacher",
      "beginner",
      "examiner",
      "example-generator",
      "final-explainer",
    ),
  },
  technical: {
    id: "technical",
    name: "Technical Council",
    description:
      "Evaluates technical topics from architecture, security, performance, and maintainability perspectives.",
    agents: buildAgents(
      "software-architect",
      "security-reviewer",
      "performance-reviewer",
      "maintainability-reviewer",
      "final-recommender",
    ),
  },
};

export function getMode(modeId: CouncilModeId): CouncilMode {
  const mode = councilModes[modeId];
  if (!mode) {
    throw new Error(`Council mode "${modeId}" not found`);
  }
  return mode;
}

export function listModes(): CouncilMode[] {
  return Object.values(councilModes);
}
