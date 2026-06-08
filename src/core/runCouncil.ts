import type {
  CouncilModeId,
  CouncilAgent,
  AgentResponse,
  FinalReport,
  RunCouncilInput,
  RunCouncilResult,
} from "./types";
import { getSpecialists, getFinalJudge } from "./types";
import { ModeNotFoundError, ProviderError, ValidationError } from "./errors";
import { logger, timed } from "./logger";
import { getMode } from "../modes";
import { createProvider } from "../providers";
import {
  buildAgentUserMessage,
  buildJudgeSystemPrompt,
  buildJudgeUserMessage,
} from "../prompts/buildPrompts";

function generateId(): string {
  return `council-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function parseJudgeReport(content: string): FinalReport {
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

/** Minimum number of successful specialist responses needed to run the judge. */
const MIN_SPECIALISTS_FOR_JUDGE = 2;

/**
 * Runs a single agent and returns its response.
 */
async function runAgent(
  agent: CouncilAgent,
  runId: string,
  provider: ReturnType<typeof import("../providers").createProvider>,
  systemPrompt: string,
  userMessage: string,
): Promise<AgentResponse> {
  const agentStart = performance.now();
  try {
    logger.debug(`Agent started: ${agent.name}`, {
      runId,
      agentId: agent.id,
      isFinalJudge: agent.isFinalJudge ?? false,
    });

    const result = await provider.generate({
      systemPrompt,
      userMessage,
      temperature: 0.7,
      maxTokens: agent.isFinalJudge ? 4096 : 2048,
    });

    const agentMs = Math.round(performance.now() - agentStart);
    logger.info(`Agent completed: ${agent.name}`, {
      runId,
      agentId: agent.id,
      model: result.model,
      durationMs: agentMs,
      responseLength: result.content.length,
      isFinalJudge: agent.isFinalJudge ?? false,
    });

    return {
      agentId: agent.id,
      agentName: agent.name,
      content: result.content,
      confidence: 4,
    };
  } catch (error) {
    const agentMs = Math.round(performance.now() - agentStart);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`Agent failed: ${agent.name}`, {
      runId,
      agentId: agent.id,
      durationMs: agentMs,
      error: errorMessage,
      isFinalJudge: agent.isFinalJudge ?? false,
    });
    return {
      agentId: agent.id,
      agentName: agent.name,
      content: `[Error: ${agent.name} failed to generate a response. ${errorMessage}]`,
      confidence: 1,
    };
  }
}

/**
 * Main council orchestration function.
 *
 * Two-phase execution:
 *  Phase 1: Run all specialist agents in parallel (independent perspectives).
 *  Phase 2: Run the final judge with all specialist responses to synthesize the report.
 *
 * If the final judge fails but specialists succeeded, a fallback report is generated.
 * If too few specialists succeed, the council still returns with a degraded report.
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

  const specialists = getSpecialists(mode);
  const finalJudge = getFinalJudge(mode);

  logger.info("Council mode loaded", {
    runId,
    mode: mode.id,
    specialistCount: specialists.length,
    judgeName: finalJudge?.name ?? "none",
    specialists: specialists.map((a) => a.name),
  });

  const provider = createProvider();

  // ─── Phase 1: Run specialist agents in parallel ───
  const { result: specialistResponses, durationMs: specialistDurationMs } =
    await timed(
      "Phase 1: Specialist agents",
      async () => {
        const promises = specialists.map((agent) =>
          runAgent(
            agent,
            runId,
            provider,
            agent.systemPrompt,
            buildAgentUserMessage(input.mode, input.input, agent),
          ),
        );
        return Promise.all(promises);
      },
      { runId, phase: "specialists" },
    );

  const successfulSpecialists = specialistResponses.filter(
    (r) => !r.content.startsWith("[Error:"),
  );
  const failedSpecialists = specialistResponses.filter((r) =>
    r.content.startsWith("[Error:"),
  );

  logger.info("Specialist responses collected", {
    runId,
    totalSpecialists: specialistResponses.length,
    successCount: successfulSpecialists.length,
    errorCount: failedSpecialists.length,
    durationMs: specialistDurationMs,
    failedAgents: failedSpecialists.map((r) => r.agentName),
  });

  // ─── Phase 2: Run the final judge ───
  let finalReport: FinalReport;
  let judgeResponse: AgentResponse | null = null;
  let judgeDurationMs = 0;

  const canRunJudge =
    finalJudge && successfulSpecialists.length >= MIN_SPECIALISTS_FOR_JUDGE;

  if (canRunJudge) {
    const { result: judgeResult, durationMs: jd } = await timed(
      "Phase 2: Final judge",
      async () => {
        // Build the judge's user message with only successful specialist responses
        const successfulAgents = mode.agents.filter((a) =>
          successfulSpecialists.some((sr) => sr.agentId === a.id),
        );

        return runAgent(
          finalJudge!,
          runId,
          provider,
          buildJudgeSystemPrompt(input.mode, mode.name),
          buildJudgeUserMessage(
            input.mode,
            input.input,
            successfulSpecialists.map((sr) => {
              const agentDef = successfulAgents.find(
                (a) => a.id === sr.agentId,
              );
              return {
                agentName: sr.agentName,
                role: agentDef?.role ?? "Specialist",
                content: sr.content,
              };
            }),
          ),
        );
      },
      { runId, phase: "final-judge" },
    );

    judgeDurationMs = jd;
    judgeResponse = judgeResult;

    if (!judgeResult.content.startsWith("[Error:")) {
      finalReport = parseJudgeReport(judgeResult.content);
      logger.info("Final judge report parsed", {
        runId,
        judgeName: finalJudge!.name,
        durationMs: judgeDurationMs,
        summaryLength: finalReport.summary.length,
        keyConclusions: finalReport.keyConclusions.length,
        agreements: finalReport.agreements.length,
        disagreements: finalReport.disagreements.length,
        risks: finalReport.risks.length,
        recommendations: finalReport.recommendations.length,
        confidence: finalReport.confidence,
      });
    } else {
      // Judge failed — generate fallback from specialist responses
      logger.error("Final judge failed, using fallback report", {
        runId,
        judgeName: finalJudge!.name,
        error: judgeResult.content,
      });
      finalReport = buildFallbackReport(specialistResponses);
    }
  } else {
    // Cannot run judge — not enough successful specialists or no judge defined
    const reason = !finalJudge
      ? "no final judge defined for this mode"
      : `only ${successfulSpecialists.length} successful specialist(s), need at least ${MIN_SPECIALISTS_FOR_JUDGE}`;

    logger.info("Skipping final judge", { runId, reason });
    finalReport = buildFallbackReport(specialistResponses);
  }

  const overallDurationMs = Math.round(performance.now() - overallStart);
  logger.info("Council run completed", {
    runId,
    mode: input.mode,
    durationMs: overallDurationMs,
    specialistDurationMs,
    judgeDurationMs,
    specialistCount: specialistResponses.length,
    successCount: successfulSpecialists.length,
    judgeRan: canRunJudge,
    judgeSucceeded:
      canRunJudge &&
      judgeResponse &&
      !judgeResponse.content.startsWith("[Error:"),
    confidence: finalReport.confidence,
  });

  return {
    id: runId,
    modeId: input.mode,
    userInput: input.input,
    agentResponses: specialistResponses,
    judgeResponse,
    finalReport,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Builds a fallback final report when the judge cannot run or fails.
 * Uses the specialist responses directly.
 */
function buildFallbackReport(
  specialistResponses: AgentResponse[],
): FinalReport {
  const successful = specialistResponses.filter(
    (r) => !r.content.startsWith("[Error:"),
  );
  const failed = specialistResponses.filter((r) =>
    r.content.startsWith("[Error:"),
  );

  return {
    summary: `Council analysis completed with ${successful.length} of ${specialistResponses.length} specialist responses. ${
      failed.length > 0
        ? `Note: ${failed.map((f) => f.agentName).join(", ")} failed to respond.`
        : ""
    }`,
    keyConclusions: successful.map(
      (r) => `${r.agentName}: ${r.content.substring(0, 200)}...`,
    ),
    agreements: [
      "See individual specialist responses for areas of convergence.",
    ],
    disagreements: [
      "See individual specialist responses for areas of divergence.",
    ],
    risks:
      failed.length > 0
        ? [
            `${failed.length} agent(s) failed to respond, reducing analysis depth.`,
          ]
        : [],
    recommendations: [
      "Review individual specialist responses for detailed insights.",
    ],
    confidence: successful.length >= 3 ? 3 : 2,
  };
}
