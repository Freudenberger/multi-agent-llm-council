import type {
  CouncilAgent,
  CouncilAgentMeta,
  AgentResponse,
  FinalReport,
  RunCouncilInput,
  RunCouncilResult,
} from "./types";
import { getSpecialists, getFinalJudge } from "./types";
import {
  ModeNotFoundError,
  ValidationError,
  CouncilAbortedError,
} from "./errors";
import { logger, timed } from "./logger";
import { logRawExchange, logRawEvent } from "./rawTranscript";
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

function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Assigns a model to every agent that has no explicit `model` by picking one
 * at random from the user's `fallbackModels` list. Each agent is picked
 * independently, so a run can spread agents across the selected models.
 * Agents that already specify a model (from their template or a customAgents
 * override) keep it — fallbacks only fill the gaps. When the list is empty the
 * mode is returned unchanged and those agents fall back to the provider default.
 *
 * `pick` is injectable so the random selection can be made deterministic in tests.
 */
export function applyFallbackModels(
  mode: ReturnType<typeof getMode>,
  fallbackModels: string[] | undefined,
  pick: (models: string[]) => string = randomPick,
): ReturnType<typeof getMode> {
  if (!fallbackModels || fallbackModels.length === 0) return mode;
  const agents = mode.agents.map((agent) =>
    agent.model ? agent : { ...agent, model: pick(fallbackModels) },
  );
  return { ...mode, agents };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Throws CouncilAbortedError if the run's signal has fired. */
function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new CouncilAbortedError();
}

function toAgentMeta(agent: CouncilAgent): CouncilAgentMeta {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    isFinalJudge: agent.isFinalJudge ?? false,
  };
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
  logContext?: Record<string, unknown>,
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
    logger.info(`${label} retry ${attempts}/${maxRetries}`, {
      ...logContext,
      backoffMs,
    });
    await delay(backoffMs);
  }

  return { result: result!, attempts };
}

// ─── Parse judge report ─────────────────────────────────────────────

function parseJudgeReport(content: string): FinalReport {
  const extractSection = (heading: string): string => {
    // Match heading and capture everything after it until the next ## heading
    // or end of string. The non-greedy [\s\S]*? ensures we stop at the first
    // subsequent heading, while the fallback to $ handles the last section
    // (which may be truncated mid-content).
    const regex = new RegExp(
      `##?\\s*${heading}[:\\s]*\\n([\\s\\S]*?)(?=\\n##|$)`,
      "i",
    );
    const match = content.match(regex);
    if (!match) return "";
    // If the captured text ends abruptly (no terminal punctuation and no
    // newline), the response was likely truncated by the token limit.
    const captured = match[1].trim();
    return captured;
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

  // Detect truncation: if the content doesn't end with a complete sentence
  // (no terminal punctuation in the last 50 chars) and is missing expected
  // sections, the response was likely cut off by the token limit.
  const last50 = content.slice(-50);
  const endsAbruptly = !/[.!?]\s*$/.test(last50);
  const hasMinimalContent =
    keyConclusions.length === 0 &&
    agreements.length === 0 &&
    recommendations.length === 0;
  const wasTruncated = endsAbruptly && hasMinimalContent;

  return {
    summary: wasTruncated
      ? summary || content.substring(0, 500) + "\n\n_(Response was truncated — the analysis may be incomplete.)_"
      : summary || content.substring(0, 500),
    keyConclusions,
    agreements,
    disagreements,
    risks,
    recommendations,
    confidence: wasTruncated ? Math.min(confidence, 2) : confidence,
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
  onProgress?: RunCouncilInput["onProgress"],
  signal?: AbortSignal,
): Promise<AgentResponse> {
  const agentStart = performance.now();
  onProgress?.({ type: "agent_started", agentId: agent.id });
  try {
    logger.debug(`Agent started: ${agent.name}`, {
      runId,
      agentId: agent.id,
      isFinalJudge: agent.isFinalJudge ?? false,
      model: model ?? "default",
    });

    // Use per-agent model if specified, otherwise fall back to shared provider
    const agentProvider = model ? createProvider(model) : provider;

    const temperature = 0.7;
    const maxTokens = agent.isFinalJudge ? 16_384 : 2048;

    const result = await agentProvider.generate({
      systemPrompt,
      userMessage,
      temperature,
      maxTokens,
      signal,
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

    // Raw transcript (opt-in via COUNCIL_RAW_LOG) — full untruncated I/O.
    logRawExchange({
      runId,
      agentId: agent.id,
      agentName: agent.name,
      role: agent.isFinalJudge ? "judge" : "specialist",
      model: result.model,
      systemPrompt,
      userMessage,
      temperature,
      maxTokens,
      response: result.content,
      durationMs: agentMs,
    });

    onProgress?.({
      type: "agent_completed",
      agentId: agent.id,
      durationMs: agentMs,
      ok: true,
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

    onProgress?.({
      type: "agent_completed",
      agentId: agent.id,
      durationMs: agentMs,
      ok: false,
    });
    logger.error(`Agent failed: ${agent.name}`, {
      runId,
      agentId: agent.id,
      durationMs: agentMs,
      error: errorMessage,
      isFinalJudge: agent.isFinalJudge ?? false,
    });

    // Raw transcript (opt-in via COUNCIL_RAW_LOG) — record the failed call too.
    logRawExchange({
      runId,
      agentId: agent.id,
      agentName: agent.name,
      role: agent.isFinalJudge ? "judge" : "specialist",
      model: model ?? "default",
      systemPrompt,
      userMessage,
      response: null,
      error: errorMessage,
      durationMs: agentMs,
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
            input.onProgress,
            input.signal,
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
  const contributors = successfulSpecialists.map((sr) => {
    const agentDef = successfulAgents.find((a) => a.id === sr.agentId);
    return {
      agentId: sr.agentId,
      agentName: sr.agentName,
      role: agentDef?.role ?? "Specialist",
      content: sr.content,
    };
  });
  const userMessage = buildJudgeUserMessage(
    input.mode,
    input.input,
    contributors.map(({ agentName, role, content }) => ({
      agentName,
      role,
      content,
    })),
  );

  // Raw transcript (opt-in via COUNCIL_RAW_LOG) — the exact request the judge
  // receives, plus the de-anonymized mapping (the prompt itself labels
  // specialists as "Response A/B/C", so record who is who here).
  logRawEvent(runId, "judge_request", {
    judgeId: finalJudge.id,
    judgeName: finalJudge.name,
    model: finalJudge.model ?? "default",
    contributors: contributors.map((c, index) => ({
      order: index,
      agentId: c.agentId,
      agentName: c.agentName,
      role: c.role,
      contentLength: c.content.length,
    })),
    systemPrompt,
    userMessage,
  });

  // The judge is actually going to run — announce the synthesis phase.
  input.onProgress?.({ type: "phase_started", phase: "judge" });

  const { result, attempts } = await withRetry(
    "Final judge",
    async () => {
      const { result, durationMs } = await timed(
        "Phase 2: Final judge",
        () =>
          runAgent(
            finalJudge,
            runId,
            provider,
            systemPrompt,
            userMessage,
            finalJudge.model,
            input.onProgress,
            input.signal,
          ),
        { runId, phase: "final-judge" },
      );
      return { result, durationMs };
    },
    (r) =>
      r.result.content.startsWith("[Error:") ||
      isReportEmpty(parseJudgeReport(r.result.content)),
    MAX_JUDGE_RETRIES,
    JUDGE_RETRY_BASE_DELAY_MS,
    { runId },
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
  const runId = input.runId ?? generateId();
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

  // Fill any agent without an explicit model by random pick from the user's list
  mode = applyFallbackModels(mode, input.fallbackModels);

  logger.info("Council mode loaded", {
    runId,
    mode: mode.id,
    specialistCount: getSpecialists(mode).length,
    judgeName: getFinalJudge(mode)?.name ?? "none",
  });

  // Raw transcript (opt-in via COUNCIL_RAW_LOG) — full run context up front.
  logRawEvent(runId, "run_started", {
    mode: mode.id,
    modeName: mode.name,
    input: input.input,
    specialists: getSpecialists(mode).map((a) => ({
      id: a.id,
      name: a.name,
      model: a.model ?? "default",
    })),
    judge: getFinalJudge(mode)?.name ?? null,
  });

  // Announce the planned roster so the client can render every agent up front.
  input.onProgress?.({
    type: "run_started",
    specialists: getSpecialists(mode).map(toAgentMeta),
    judge: getFinalJudge(mode) ? toAgentMeta(getFinalJudge(mode)!) : null,
  });

  const provider = createProvider();

  // Phase 1
  throwIfAborted(input.signal);
  input.onProgress?.({ type: "phase_started", phase: "specialists" });
  const {
    all: specialistResponses,
    successful: successfulSpecialists,
    durationMs: specialistDurationMs,
  } = await runSpecialists(mode, input, runId, provider);

  // Stop here if the user cancelled while specialists were running.
  throwIfAborted(input.signal);

  // Raw transcript (opt-in via COUNCIL_RAW_LOG) — every specialist's full
  // response and confidence after Phase 1 completes.
  logRawEvent(runId, "specialists_completed", {
    durationMs: specialistDurationMs,
    responses: specialistResponses.map((r) => ({
      agentId: r.agentId,
      agentName: r.agentName,
      confidence: r.confidence,
      failed: r.content.startsWith("[Error:"),
      content: r.content,
    })),
  });

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

  // Raw transcript (opt-in via COUNCIL_RAW_LOG) — the judge's raw output and
  // the parsed final report that closes out the run.
  logRawEvent(runId, "run_completed", {
    durationMs: overallDurationMs,
    specialistDurationMs,
    judgeDurationMs,
    judgeRan: canRunJudge,
    judgeResponse: judgeResponse?.content ?? null,
    finalReport,
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
