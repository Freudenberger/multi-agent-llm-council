import type {
  CouncilModeId,
  AgentResponse,
  FinalReport,
  RunCouncilInput,
  RunCouncilResult,
} from "./types";
import { ModeNotFoundError, ProviderError, ValidationError } from "./errors";
import { logger, timed } from "./logger";
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
  const runId = generateId();
  const overallStart = performance.now();

  logger.info("Council run started", {
    runId,
    mode: input.mode,
    inputLength: input.input.length,
  });
  logger.debug("Council run input", { runId, input: input.input });

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

  logger.info("Council mode loaded", {
    runId,
    mode: mode.id,
    agentCount: mode.agents.length,
    agents: mode.agents.map((a) => a.name),
  });

  const provider = createProvider();

  // Run all agents in parallel
  const { result: agentResponses, durationMs: agentDurationMs } = await timed(
    "Agent responses",
    async () => {
      const agentPromises = mode.agents.map(async (agent) => {
        const agentStart = performance.now();
        try {
          logger.debug(`Agent started: ${agent.name}`, {
            runId,
            agentId: agent.id,
          });

          const result = await provider.generate({
            systemPrompt: agent.systemPrompt,
            userMessage: buildAgentUserMessage(input.mode, input.input, agent),
            temperature: 0.7,
            maxTokens: 2048,
          });

          const agentMs = Math.round(performance.now() - agentStart);
          logger.info(`Agent completed: ${agent.name}`, {
            runId,
            agentId: agent.id,
            model: result.model,
            durationMs: agentMs,
            responseLength: result.content.length,
          });

          return {
            agentId: agent.id,
            agentName: agent.name,
            content: result.content,
            confidence: 4,
          } satisfies AgentResponse;
        } catch (error) {
          const agentMs = Math.round(performance.now() - agentStart);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logger.error(`Agent failed: ${agent.name}`, {
            runId,
            agentId: agent.id,
            durationMs: agentMs,
            error: errorMessage,
          });
          return {
            agentId: agent.id,
            agentName: agent.name,
            content: `[Error: ${agent.name} failed to generate a response. ${errorMessage}]`,
            confidence: 1,
          } satisfies AgentResponse;
        }
      });

      return Promise.all(agentPromises);
    },
    { runId, phase: "agent-responses" },
  );

  const successCount = agentResponses.filter(
    (r) => !r.content.startsWith("[Error:"),
  ).length;
  const errorCount = agentResponses.length - successCount;
  logger.info("Agent responses collected", {
    runId,
    totalAgents: agentResponses.length,
    successCount,
    errorCount,
    durationMs: agentDurationMs,
  });

  // Generate final synthesis
  let finalReport: FinalReport;
  const { result: synthesisResult, durationMs: synthesisDurationMs } =
    await timed(
      "Synthesis",
      async () => {
        try {
          const result = await provider.generate({
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
          return {
            success: true,
            content: result.content,
            model: result.model,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logger.error("Synthesis failed", {
            runId,
            error: errorMessage,
          });
          return { success: false, content: "", model: "none" };
        }
      },
      { runId, phase: "synthesis" },
    );

  if (synthesisResult.success) {
    finalReport = parseSynthesis(synthesisResult.content);
    logger.info("Synthesis parsed successfully", {
      runId,
      model: synthesisResult.model,
      durationMs: synthesisDurationMs,
      summaryLength: finalReport.summary.length,
      keyConclusions: finalReport.keyConclusions.length,
      agreements: finalReport.agreements.length,
      disagreements: finalReport.disagreements.length,
      risks: finalReport.risks.length,
      recommendations: finalReport.recommendations.length,
      confidence: finalReport.confidence,
    });
  } else {
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

  const overallDurationMs = Math.round(performance.now() - overallStart);
  logger.info("Council run completed", {
    runId,
    mode: input.mode,
    durationMs: overallDurationMs,
    agentDurationMs,
    synthesisDurationMs,
    agentCount: agentResponses.length,
    successCount,
    errorCount,
    confidence: finalReport.confidence,
  });

  return {
    id: runId,
    modeId: input.mode,
    userInput: input.input,
    agentResponses,
    finalReport,
    createdAt: new Date().toISOString(),
  };
}
