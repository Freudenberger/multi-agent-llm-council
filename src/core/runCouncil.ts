import type {
  CouncilAgent,
  AgentResponse,
  FinalReport,
  RunCouncilInput,
  RunCouncilResult,
} from "./types";
import { getSpecialists, getFinalJudge } from "./types";
import { ModeNotFoundError, ValidationError } from "./errors";
import { logger, timed } from "./logger";
import { getMode } from "../modes";
import { createProvider } from "../providers";
import {
  buildAgentUserMessage,
  buildJudgeSystemPrompt,
  buildJudgeUserMessage,
} from "../prompts/buildPrompts";

// ─── Constants ──────────────────────────────────────────────────────

const MIN_SPECIALISTS_FOR_JUDGE = 2;

const MAX_JUDGE_RETRIES = 2;
const JUDGE_RETRY_BASE_DELAY_MS = 1000;

// ─── Helpers ────────────────────────────────────────────────────────

function generateId(): string {
  return `council-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Merges user-provided custom agent overrides into a council mode.
 * Agents with `enabled: false` are filtered out entirely.
 * Returns a new mode object with overridden agents where matching ids are found.
 */
function mergeCustomAgents(
  mode: ReturnType<typeof getMode>,
  customAgents: RunCouncilInput["customAgents"],
): ReturnType<typeof getMode> {
  if (!customAgents || Object.keys(customAgents).length === 0) return mode;

  const mergedAgents = mode.agents
    .map((agent) => {
      const override = customAgents[agent.id];
      if (!override) return agent;
      return { ...agent, ...override };
    })
    .filter((agent) => agent.disabled !== true);

  return { ...mode, agents: mergedAgents };
}

/**
 * Normalizes judge configuration after customizations.
 * - If multiple judges are set, keeps only the first as judge and demotes the rest to specialists.
 * - If zero judges, logs a warning — the run will proceed in specialist-only mode (fallback report).
 */
function normalizeJudges(
  mode: ReturnType<typeof getMode>,
  runId: string,
): ReturnType<typeof getMode> {
  const judgeIndices: number[] = [];
  mode.agents.forEach((a, i) => {
    if (a.isFinalJudge) judgeIndices.push(i);
  });

  if (judgeIndices.length === 0) {
    logger.info(
      "No judge agent defined after customizations — will use fallback report",
      {
        runId,
        mode: mode.id,
      },
    );
    return mode;
  }

  if (judgeIndices.length > 1) {
    logger.info(
      "Multiple judges detected — keeping the first, demoting others to specialists",
      {
        runId,
        mode: mode.id,
        judgeCount: judgeIndices.length,
        keptJudge: mode.agents[judgeIndices[0]].name,
        demoted: judgeIndices.slice(1).map((i) => mode.agents[i].name),
      },
    );
    // Demote all judges except the first
    const demoted = new Set(judgeIndices.slice(1));
    const normalizedAgents = mode.agents.map((a, i) =>
      demoted.has(i) ? { ...a, isFinalJudge: false } : a,
    );
    return { ...mode, agents: normalizedAgents };
  }

  return mode;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generic retry wrapper with exponential backoff.
 * Calls `fn` up to `maxRetries + 1` times. If `shouldRetry(result)` returns
 * true, waits with exponential backoff and tries again.
 */
async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  shouldRetry: (result: T) => boolean,
  maxRetries: number,
  baseDelayMs: number,
): Promise<{ result: T; attempts: number }> {
  let attempts = 0;
  let result: T;

  while (true) {
    attempts++;
    result = await fn();

    if (!shouldRetry(result) || attempts > maxRetries) {
      break;
    }

    const backoffMs = baseDelayMs * Math.pow(2, attempts - 1);
    logger.info(`${label} retry ${attempts}/${maxRetries}`, { backoffMs });
    await delay(backoffMs);
  }

  return { result: result!, attempts };
}

// ─── Parse judge report ─────────────────────────────────────────────

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

function isReportEmpty(report: FinalReport): boolean {
  return (
    !report.summary?.trim() &&
    report.keyConclusions.length === 0 &&
    report.agreements.length === 0 &&
    report.disagreements.length === 0 &&
    report.risks.length === 0 &&
    report.recommendations.length === 0
  );
}

// ─── Run a single agent ─────────────────────────────────────────────

async function runAgent(
  agent: CouncilAgent,
  runId: string,
  provider: ReturnType<typeof import("../providers").createProvider>,
  systemPrompt: string,
  userMessage: string,
  model?: string,
): Promise<AgentResponse> {
  const agentStart = performance.now();
  try {
    logger.debug(`Agent started: ${agent.name}`, {
      runId,
      agentId: agent.id,
      isFinalJudge: agent.isFinalJudge ?? false,
      model: model ?? "default",
    });

    // Use per-agent model if specified, otherwise fall back to shared provider
    const agentProvider = model ? createProvider(model) : provider;

    const result = await agentProvider.generate({
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

// ─── Phase 1: Specialist agents ─────────────────────────────────────

async function runSpecialists(
  mode: ReturnType<typeof getMode>,
  input: RunCouncilInput,
  runId: string,
  provider: ReturnType<typeof createProvider>,
): Promise<{
  all: AgentResponse[];
  successful: AgentResponse[];
  failed: AgentResponse[];
  durationMs: number;
}> {
  const specialists = getSpecialists(mode);

  const { result: responses, durationMs } = await timed(
    "Phase 1: Specialist agents",
    () =>
      Promise.all(
        specialists.map((agent) =>
          runAgent(
            agent,
            runId,
            provider,
            agent.systemPrompt,
            buildAgentUserMessage(input.mode, input.input, agent),
            agent.model,
          ),
        ),
      ),
    { runId, phase: "specialists" },
  );

  const successful = responses.filter((r) => !r.content.startsWith("[Error:"));
  const failed = responses.filter((r) => r.content.startsWith("[Error:"));

  logger.info("Specialist responses collected", {
    runId,
    totalSpecialists: responses.length,
    successCount: successful.length,
    errorCount: failed.length,
    durationMs,
    failedAgents: failed.map((r) => r.agentName),
  });

  return { all: responses, successful, failed, durationMs };
}

// ─── Phase 2: Final judge with retry ────────────────────────────────

async function runJudge(
  mode: ReturnType<typeof getMode>,
  input: RunCouncilInput,
  runId: string,
  provider: ReturnType<typeof createProvider>,
  specialistResponses: AgentResponse[],
  successfulSpecialists: AgentResponse[],
): Promise<{
  finalReport: FinalReport;
  judgeResponse: AgentResponse | null;
  durationMs: number;
}> {
  const finalJudge = getFinalJudge(mode);

  const fallbackReport = buildFallbackReport(specialistResponses);

  if (!finalJudge || successfulSpecialists.length < MIN_SPECIALISTS_FOR_JUDGE) {
    const reason = !finalJudge
      ? "no final judge defined"
      : `only ${successfulSpecialists.length} successful specialist(s), need ${MIN_SPECIALISTS_FOR_JUDGE}`;
    logger.info("Skipping final judge", { runId, reason });
    return { finalReport: fallbackReport, judgeResponse: null, durationMs: 0 };
  }

  // Build judge inputs once — reused across retries
  const successfulAgents = mode.agents.filter((a) =>
    successfulSpecialists.some((sr) => sr.agentId === a.id),
  );
  const systemPrompt = buildJudgeSystemPrompt(input.mode, mode.name);
  const userMessage = buildJudgeUserMessage(
    input.mode,
    input.input,
    successfulSpecialists.map((sr) => {
      const agentDef = successfulAgents.find((a) => a.id === sr.agentId);
      return {
        agentName: sr.agentName,
        role: agentDef?.role ?? "Specialist",
        content: sr.content,
      };
    }),
  );

  const { result, attempts } = await withRetry(
    "Final judge",
    async () => {
      const { result, durationMs } = await timed(
        "Phase 2: Final judge",
        () => runAgent(finalJudge, runId, provider, systemPrompt, userMessage, finalJudge.model),
        { runId, phase: "final-judge" },
      );
      return { result, durationMs };
    },
    (r) =>
      r.result.content.startsWith("[Error:") ||
      isReportEmpty(parseJudgeReport(r.result.content)),
    MAX_JUDGE_RETRIES,
    JUDGE_RETRY_BASE_DELAY_MS,
  );

  const judgeResponse = result.result;

  if (
    judgeResponse.content.startsWith("[Error:") ||
    isReportEmpty(parseJudgeReport(judgeResponse.content))
  ) {
    logger.error("Final judge retries exhausted, using fallback", {
      runId,
      judgeName: finalJudge.name,
      attempts,
    });
    return {
      finalReport: fallbackReport,
      judgeResponse,
      durationMs: result.durationMs,
    };
  }

  const report = parseJudgeReport(judgeResponse.content);
  logger.info("Final judge report parsed", {
    runId,
    judgeName: finalJudge.name,
    durationMs: result.durationMs,
    attempts,
    summaryLength: report.summary.length,
    keyConclusions: report.keyConclusions.length,
    agreements: report.agreements.length,
    disagreements: report.disagreements.length,
    risks: report.risks.length,
    recommendations: report.recommendations.length,
    confidence: report.confidence,
  });

  return { finalReport: report, judgeResponse, durationMs: result.durationMs };
}

// ─── Fallback report ────────────────────────────────────────────────

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

// ─── Main orchestrator ──────────────────────────────────────────────

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

  if (!input.input?.trim()) throw new ValidationError("Input cannot be empty");
  if (!input.mode) throw new ValidationError("Mode must be specified");

  let mode;
  try {
    mode = getMode(input.mode);
  } catch {
    throw new ModeNotFoundError(input.mode);
  }

  // Apply any user-provided agent customizations
  mode = mergeCustomAgents(mode, input.customAgents);

  // Normalize judge configuration after customizations
  mode = normalizeJudges(mode, runId);

  logger.info("Council mode loaded", {
    runId,
    mode: mode.id,
    specialistCount: getSpecialists(mode).length,
    judgeName: getFinalJudge(mode)?.name ?? "none",
  });

  const provider = createProvider();

  // Phase 1
  const {
    all: specialistResponses,
    successful: successfulSpecialists,
    durationMs: specialistDurationMs,
  } = await runSpecialists(mode, input, runId, provider);

  // Phase 2
  const {
    finalReport,
    judgeResponse,
    durationMs: judgeDurationMs,
  } = await runJudge(
    mode,
    input,
    runId,
    provider,
    specialistResponses,
    successfulSpecialists,
  );

  // Done
  const overallDurationMs = Math.round(performance.now() - overallStart);
  const canRunJudge =
    !!getFinalJudge(mode) &&
    successfulSpecialists.length >= MIN_SPECIALISTS_FOR_JUDGE;

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
      !!judgeResponse &&
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
