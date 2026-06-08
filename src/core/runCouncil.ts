import type {
  CouncilModeId,
  AgentResponse,
  FinalReport,
  RunCouncilInput,
  RunCouncilResult,
} from "./types";
import { ModeNotFoundError, ProviderError, ValidationError } from "./errors";
import { getMode } from "../modes";
import { createProvider } from "../providers";
import {
  buildAgentUserMessage,
  buildSynthesisSystemPrompt,
  buildSynthesisUserMessage,
} from "../prompts/buildPrompts";

function generateId(): string {
  return `council-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function parseSynthesis(content: string): FinalReport {
  // Simple parser that extracts sections from the synthesized markdown
  const extractSection = (heading: string): string => {
    const regex = new RegExp(
      `##?\\s*${heading}[:\\s]*\\n([\\s\\S]*?)(?=\\n##|$)`,
      "i",
    );
    const match = content.match(regex);
    return match ? match[1].trim() : "";
  };

  const extractList = (heading: string): string[] => {
    const section = extractSection(heading);
    if (!section) return [];
    return section
      .split("\n")
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter((line) => line.length > 0);
  };

  const summary = extractSection("Summary");
  const keyConclusions = extractList("Key Conclusions");
  const agreements = extractList("Areas of Agreement");
  const disagreements = extractList("Areas of Disagreement");
  const risks = extractList("Risks and Limitations");
  const recommendations = extractList("Recommendations");

  // Parse confidence score
  const confidenceSection = extractSection("Confidence Score");
  let confidence = 3;
  const confidenceMatch = confidenceSection.match(/([1-5])/);
  if (confidenceMatch) {
    confidence = parseInt(confidenceMatch[1], 10);
  }

  return {
    summary: summary || content.substring(0, 500),
    keyConclusions,
    agreements,
    disagreements,
    risks,
    recommendations,
    confidence,
  };
}

/**
 * Main council orchestration function.
 * Runs all agents in parallel, collects responses, and generates final synthesis.
 */
export async function runCouncil(
  input: RunCouncilInput,
): Promise<RunCouncilResult> {
  // Validate input
  if (!input.input?.trim()) {
    throw new ValidationError("Input cannot be empty");
  }
  if (!input.mode) {
    throw new ValidationError("Mode must be specified");
  }

  // Get the council mode configuration
  let mode;
  try {
    mode = getMode(input.mode);
  } catch {
    throw new ModeNotFoundError(input.mode);
  }

  const provider = createProvider();

  // Run all agents in parallel
  const agentPromises = mode.agents.map(async (agent) => {
    try {
      const result = await provider.generate({
        systemPrompt: agent.systemPrompt,
        userMessage: buildAgentUserMessage(input.mode, input.input, agent),
        temperature: 0.7,
        maxTokens: 2048,
      });

      return {
        agentId: agent.id,
        agentName: agent.name,
        content: result.content,
        confidence: 4,
      } satisfies AgentResponse;
    } catch (error) {
      console.error(`Agent ${agent.name} failed:`, error);
      return {
        agentId: agent.id,
        agentName: agent.name,
        content: `[Error: ${agent.name} failed to generate a response. ${
          error instanceof Error ? error.message : "Unknown error"
        }]`,
        confidence: 1,
      } satisfies AgentResponse;
    }
  });

  const agentResponses = await Promise.all(agentPromises);

  // Generate final synthesis
  let finalReport: FinalReport;
  try {
    const synthesisResult = await provider.generate({
      systemPrompt: buildSynthesisSystemPrompt(),
      userMessage: buildSynthesisUserMessage(
        input.mode,
        input.input,
        agentResponses.map((r) => ({
          agentName: r.agentName,
          content: r.content,
        })),
      ),
      temperature: 0.5,
      maxTokens: 4096,
    });

    finalReport = parseSynthesis(synthesisResult.content);
  } catch (error) {
    console.error("Synthesis failed:", error);
    // Fallback: create a basic report from agent responses
    finalReport = {
      summary: `Analysis completed with ${agentResponses.length} agent perspectives. Synthesis generation encountered an issue.`,
      keyConclusions: agentResponses.map(
        (r) => `${r.agentName}: ${r.content.substring(0, 200)}...`,
      ),
      agreements: ["All agents provided their perspectives"],
      disagreements: [
        "See individual agent responses for differing viewpoints",
      ],
      risks: ["Synthesis could not be fully generated"],
      recommendations: [
        "Review individual agent responses for detailed insights",
      ],
      confidence: 2,
    };
  }

  return {
    id: generateId(),
    modeId: input.mode,
    userInput: input.input,
    agentResponses,
    finalReport,
    createdAt: new Date().toISOString(),
  };
}
