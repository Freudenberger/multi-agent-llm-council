import type { CouncilMode, CouncilModeId } from "../core/types";
import { ModeNotFoundError } from "../core/errors";
import { agentTemplates, buildSystemPrompt } from "../agents/defaultAgents";

function buildAgents(...ids: string[]) {
  return ids.map((id) => {
    const template = agentTemplates.find((a: { id: string }) => a.id === id);
    if (!template) throw new Error(`Agent template "${id}" not found`);
    return {
      id: template.id,
      name: template.name,
      role: template.role,
      // Compose the shared council framing (base/final rules + output contract)
      // with the template's perspective, instead of the bare perspective.
      systemPrompt: buildSystemPrompt(template),
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
  answer: {
    id: "answer",
    name: "Answer Council",
    description:
      "Provides a comprehensive answer to a question by combining multiple perspectives.",
    agents: buildAgents(
      "subject-matter-expert",
      "contrarian",
      "contextualizer",
      "synthesizer",
      "final-summarizer",
    ),
  },
  swot: {
    id: "swot",
    name: "SWOT Council",
    description:
      "Analyzes a subject across the four SWOT quadrants — strengths, weaknesses, opportunities, threats — then synthesizes a strategic recommendation.",
    agents: buildAgents(
      "strengths-analyst",
      "weaknesses-analyst",
      "opportunities-analyst",
      "threats-analyst",
      "swot-strategist",
    ),
  },
};

export function getMode(modeId: CouncilModeId): CouncilMode {
  const mode = councilModes[modeId];
  if (!mode) {
    throw new ModeNotFoundError(modeId);
  }
  return mode;
}

export function listModes(): CouncilMode[] {
  return Object.values(councilModes);
}
