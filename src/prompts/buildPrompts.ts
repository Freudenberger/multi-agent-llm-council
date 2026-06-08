import type { CouncilAgent } from "../core/types";

const MODE_DESCRIPTIONS: Record<string, string> = {
  decision:
    "decision analysis council. The agents are analyzing a decision to understand its benefits, risks, feasibility, and consequences.",
  idea: "idea evaluation council. The agents are evaluating an idea for its creativity, market potential, technical feasibility, and user value.",
  criticalReview:
    "critical review council. The agents are reviewing text, an argument, or a proposal for logical soundness, clarity, and evidence quality.",
  learning:
    "learning council. The agents are explaining an educational concept from multiple teaching perspectives.",
  technical:
    "technical analysis council. The agents are evaluating a technical topic from architecture, security, performance, and maintainability perspectives.",
};

/**
 * Builds the user message for a specialist agent.
 * Specialists only see the original question — not other agents' responses.
 */
export function buildAgentUserMessage(
  modeId: string,
  userInput: string,
  agent: CouncilAgent,
): string {
  const modeDesc =
    MODE_DESCRIPTIONS[modeId] || "multi-perspective analysis council";

  return `You are participating in a ${modeDesc}

Your role: ${agent.name} — ${agent.role}

Question/Topic:
${userInput}

Provide your independent analysis from your specific perspective. Be specific, detailed, and stay in character. Do not reference other agents' responses — you are providing your own independent analysis.`;
}

/**
 * Builds the system prompt for the final judge.
 */
export function buildJudgeSystemPrompt(
  modeId: string,
  modeName: string,
): string {
  return `You are the Final Judge in a ${modeName}.

You will receive the original question/topic and independent responses from several specialist agents.

Your responsibilities:
1. COMPARE all specialist responses — identify where they align and where they diverge.
2. IDENTIFY AGREEMENTS — find points where multiple specialists converge.
3. IDENTIFY DISAGREEMENTS — highlight areas of genuine disagreement and explain why.
4. DETECT RISKS AND WEAK REASONING — flag any logical gaps, unsupported claims, or overlooked risks.
5. PRESERVE IMPORTANT MINORITY OPINIONS — if one specialist raises a valid point others missed, include it.
6. GENERATE A STRUCTURED FINAL REPORT with the following sections:

## Summary
[2-3 sentence overview of the council's collective analysis]

## Key Conclusions
- [Most important conclusion]
- [Second conclusion]
- [Add more as needed]

## Areas of Agreement
- [What most/all specialists agreed on]
- [Add more as needed]

## Areas of Disagreement
- [Where specialists genuinely disagreed]
- [Add more as needed]

## Risks and Limitations
- [Risks identified by specialists or gaps in the analysis]
- [Add more as needed]

## Recommendations
1. [Actionable recommendation]
2. [Second recommendation]
3. [Add more as needed]

## Confidence Score
[Score from 1-5 with brief justification. Consider: agreement level, evidence quality, completeness of analysis.]

Be balanced, fair, and thorough. Acknowledge uncertainty where it exists. Do not simply pick the "best" response — synthesize all perspectives.`;
}

/**
 * Builds the user message for the final judge.
 * The judge receives the original input plus all specialist responses.
 */
export function buildJudgeUserMessage(
  modeId: string,
  userInput: string,
  agentResponses: { agentName: string; role: string; content: string }[],
): string {
  const responsesText = agentResponses
    .map((r) => `### ${r.agentName} (${r.role})\n${r.content}`)
    .join("\n\n---\n\n");

  return `Original Question/Topic:
${userInput}

---

Specialist Agent Responses:

${responsesText}

---

Please evaluate all specialist responses and produce the final structured report.`;
}
