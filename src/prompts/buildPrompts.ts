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
  answer:
    "answer council. The agents are providing a comprehensive answer to a question by combining multiple perspectives and expertise.",
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
 * Builds the system prompt for the peer-review/ranking phase. Each specialist
 * re-enters as an impartial reviewer of the anonymized responses.
 */
export function buildPeerReviewSystemPrompt(modeName: string): string {
  return `You are now acting as an impartial peer reviewer in a ${modeName}.

You will be shown several candidate responses to the same question, each labeled "Response A", "Response B", etc. The responses are anonymized — you are NOT told which one (if any) is your own, so judge purely on merit.

Your task:
1. Briefly evaluate each response on quality, correctness, reasoning, and usefulness (1-2 sentences each).
2. Rank the responses from best to worst.

Be objective and specific. Do not reveal or guess authorship. Keep the evaluation proportional to the question.

Format your answer exactly as:

## Evaluations
- Response A: <short assessment>
- Response B: <short assessment>
- [one line per response]

## Ranking
1. Response <letter> — <one-line reason it ranks highest>
2. Response <letter> — <reason>
[continue for every response, best to worst]`;
}

/**
 * Builds the system prompt for the final judge.
 */
export function buildJudgeSystemPrompt(
  modeId: string,
  modeName: string,
): string {
  switch (modeId) {
    case "answer":
      return buildAnswerJudgeSystemPrompt(modeName);

    case "decision":
    case "idea":
    case "critical-review":
    case "learning":
    case "technical":
    default:
      return buildReportJudgeSystemPrompt(modeName);
  }
}

function buildAnswerJudgeSystemPrompt(modeName: string): string {
  return `You are the Final Answer Judge in an ${modeName}.

You will receive the original user question and independent responses from several specialist agents.

Your task is to produce the final user-facing answer.

CRITICAL RULES:
- Answer the user's original question directly.
- Do NOT produce a Council Analysis Report.
- Do NOT mention the council, agents, specialists, internal reasoning, agreements, disagreements, risks, limitations, or confidence score.
- Do NOT evaluate the specialist responses.
- Do NOT summarize the debate.
- Do NOT include sections like Summary, Key Conclusions, Areas of Agreement, Areas of Disagreement, Risks and Limitations, Recommendations, or Confidence Score.
- The final answer must be useful as a standalone response to the user.

How to answer:
- If the question is simple, give a simple and practical answer.
- If the user asks for a recommendation, choose a best default option.
- If the user asks what to eat, suggest actual meals.
- If the user asks how to do something, give concrete steps.
- If the user asks a technical question, provide the solution, code, or implementation guidance.
- If the user asks a learning question, explain clearly with examples.
- If context is missing, make reasonable assumptions and provide flexible options.
- Ask a follow-up question only if the answer would otherwise be unsafe, impossible, or very likely wrong.

Preferred structure for simple questions:
1. Direct answer first.
2. 2-5 concrete options or steps if useful.
3. One short optional follow-up question only if it helps.

Bad final answer:
"The specialists agree that quick meals are important..."

Good final answer:
"Make eggs on toast. It is quick, filling, and uses basic ingredients. Other easy options: quesadilla, pasta with tomato sauce, rice with egg and vegetables, or grilled cheese."

Always optimize for usefulness, directness, and the user's actual intent.`;
}

function buildReportJudgeSystemPrompt(modeName: string): string {
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
 * Builds the user message for the peer-review/ranking phase.
 * The reviewer sees the original question and every specialist response
 * anonymized as "Response A/B/C…" (authorship withheld to prevent bias).
 */
export function buildPeerReviewUserMessage(
  userInput: string,
  anonymizedResponses: { label: string; content: string }[],
): string {
  const responsesText = anonymizedResponses
    .map((r) => `### ${r.label}\n${r.content}`)
    .join("\n\n---\n\n");

  return `Original Question/Topic:
${userInput}

---

Candidate Responses (anonymized):

${responsesText}

---

Evaluate each response and rank them from best to worst using the required format.`;
}

/**
 * Builds the user message for the final judge.
 * The judge receives the original input plus all specialist responses, and —
 * when the peer-review phase ran — the specialists' peer evaluations/rankings.
 */
export function buildJudgeUserMessage(
  modeId: string,
  userInput: string,
  agentResponses: { agentName: string; role: string; content: string }[],
  peerReviews?: { agentName: string; content: string }[],
): string {
  const responsesText = agentResponses
    .map((r) => `### ${r.agentName} (${r.role})\n${r.content}`)
    .join("\n\n---\n\n");

  const peerReviewBlock =
    peerReviews && peerReviews.length > 0
      ? `\n\nPeer Evaluations & Rankings (each specialist scored the anonymized responses):

${peerReviews
  .map((p) => `### ${p.agentName}'s peer review\n${p.content}`)
  .join("\n\n---\n\n")}

Use these peer rankings to weight your synthesis — favor what peers ranked highest, but preserve valuable minority points the rankings may have undervalued.`
      : "";

  return `Original Question/Topic:
${userInput}

---

Specialist Agent Responses:

${responsesText}${peerReviewBlock}

---

Please evaluate all specialist responses and produce the final structured report.`;
}
