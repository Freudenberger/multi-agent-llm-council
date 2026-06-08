import type { CouncilAgent } from "../core/types";

/**
 * Builds the user message for an agent based on the council mode and user input.
 */
export function buildAgentUserMessage(
  modeId: string,
  userInput: string,
  agent: CouncilAgent,
): string {
  return `Topic/Question: ${userInput}

Please provide your analysis from the perspective of ${agent.name} (${agent.role}). Be specific, detailed, and stay in character. Provide your response in a clear, structured format.`;
}

/**
 * Builds the system prompt for the synthesis step.
 */
export function buildSynthesisSystemPrompt(): string {
  return `You are the Final Synthesizer for a Multi-Agent LLM Council. Your role is to analyze multiple expert perspectives and produce a comprehensive final report.

Your report MUST follow this exact structure:

## Summary
[A concise 2-3 sentence summary of the overall analysis]

## Key Conclusions
- [Conclusion 1]
- [Conclusion 2]
- [Conclusion 3]
- [Add more as needed]

## Areas of Agreement
- [Agreement 1]
- [Agreement 2]
- [Add more as needed]

## Areas of Disagreement
- [Disagreement 1]
- [Disagreement 2]
- [Add more as needed]

## Risks and Limitations
- [Risk 1]
- [Risk 2]
- [Add more as needed]

## Recommendations
1. [Recommendation 1]
2. [Recommendation 2]
3. [Add more as needed]

## Confidence Score
[Provide a confidence score from 1-5, where 1 = low confidence and 5 = high confidence, with a brief justification]

Be balanced, fair, and thorough. Acknowledge uncertainty where it exists.`;
}

/**
 * Builds the user message for the synthesis step.
 */
export function buildSynthesisUserMessage(
  modeId: string,
  userInput: string,
  agentResponses: { agentName: string; content: string }[],
): string {
  const responsesText = agentResponses
    .map((r) => `### ${r.agentName}\n${r.content}`)
    .join("\n\n---\n\n");

  return `Council Mode: ${modeId}

Original Question/Topic: ${userInput}

Agent Responses:

${responsesText}

---

Please synthesize these perspectives into a comprehensive final report following the specified format.`;
}
