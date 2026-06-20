import type {
  CouncilAgent,
  CouncilAgentMeta,
  DiscussionSummary,
  DiscussionTurn,
  RunDiscussionInput,
  RunDiscussionResult,
} from "./types";
import {
  DISCUSSION_MIN_AGENTS,
  DISCUSSION_MAX_AGENTS,
  DISCUSSION_MIN_ROUNDS,
  DISCUSSION_MAX_ROUNDS,
} from "./types";
import { ValidationError, CouncilAbortedError } from "./errors";
import { logger } from "./logger";
import { logRawExchange, logRawEvent } from "./rawTranscript";
import { createProvider } from "../providers";
import { resolveAgent } from "../agents/defaultAgents";
import {
  buildDiscussionSystemPrompt,
  buildDiscussionUserMessage,
  buildDiscussionSummarySystemPrompt,
  buildDiscussionSummaryUserMessage,
} from "../prompts/buildPrompts";

// ─── Constants ──────────────────────────────────────────────────────

const DISCUSSION_TEMPERATURE = 0.8;
const DISCUSSION_MAX_TOKENS = 1024;

/** The closing summary is lower-temperature and gets more room than a turn. */
const SUMMARY_TEMPERATURE = 0.5;
const SUMMARY_MAX_TOKENS = 2048;

/** Max times a single turn is re-generated when the reply is degenerate. */
const MAX_TURN_RETRIES = 2;
const TURN_RETRY_BASE_DELAY_MS = 500;
/** Replies shorter than this (after trim) are treated as non-substantive. */
const MIN_MEANINGFUL_TURN_LENGTH = 25;

/**
 * Label-style artifacts that some models emit instead of actually participating
 * (e.g. a moderation/classification header like "User Safety: safe"). Such a
 * reply contributes nothing to the discussion, so it triggers a retry.
 */
const DEGENERATE_LABEL = /^\s*(user\s*safety|content\s*safety|safety|moderation|classification|policy)\s*:/i;

/**
 * Returns true when a model reply is not a usable discussion turn: empty,
 * trivially short, or a bare label/classification line. Exported for tests.
 */
export function isDegenerateResponse(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length < MIN_MEANINGFUL_TURN_LENGTH) return true;
  if (DEGENERATE_LABEL.test(trimmed)) return true;
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Helpers ────────────────────────────────────────────────────────

function generateId(): string {
  return `discussion-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
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
    isFinalJudge: false,
  };
}

/**
 * Resolves and validates the requested participants. Each participant without
 * an explicit model is assigned one at random from `fallbackModels` (stable for
 * the whole run, so an agent uses the same model every round).
 */
function resolveParticipants(
  agentIds: string[],
  fallbackModels: string[] | undefined,
): CouncilAgent[] {
  return agentIds.map((id) => {
    const agent = resolveAgent(id);
    if (!agent) throw new ValidationError(`Unknown agent: "${id}"`);
    if (agent.model || !fallbackModels || fallbackModels.length === 0) {
      return agent;
    }
    return { ...agent, model: randomPick(fallbackModels) };
  });
}

function validate(input: RunDiscussionInput): void {
  if (!input.topic?.trim()) throw new ValidationError("Topic cannot be empty");

  const ids = input.agentIds ?? [];
  if (ids.length < DISCUSSION_MIN_AGENTS || ids.length > DISCUSSION_MAX_AGENTS) {
    throw new ValidationError(
      `Select between ${DISCUSSION_MIN_AGENTS} and ${DISCUSSION_MAX_AGENTS} agents`,
    );
  }
  if (new Set(ids).size !== ids.length) {
    throw new ValidationError("Each agent can only be selected once");
  }

  const rounds = input.rounds;
  if (
    !Number.isInteger(rounds) ||
    rounds < DISCUSSION_MIN_ROUNDS ||
    rounds > DISCUSSION_MAX_ROUNDS
  ) {
    throw new ValidationError(
      `Rounds must be a whole number between ${DISCUSSION_MIN_ROUNDS} and ${DISCUSSION_MAX_ROUNDS}`,
    );
  }
}

// ─── Run a single turn ──────────────────────────────────────────────

async function runTurn(
  agent: CouncilAgent,
  runId: string,
  sharedProvider: ReturnType<typeof createProvider>,
  topic: string,
  transcript: DiscussionTurn[],
  round: number,
  totalRounds: number,
  index: number,
  participantNames: string[],
  signal: AbortSignal | undefined,
  providerOverride: RunDiscussionInput["providerOverride"],
): Promise<{ turn: DiscussionTurn; durationMs: number }> {
  const start = performance.now();
  const systemPrompt = buildDiscussionSystemPrompt(agent, participantNames);
  const userMessage = buildDiscussionUserMessage(
    topic,
    transcript,
    agent,
    round,
    totalRounds,
  );

  // Per-agent model if specified, otherwise the shared provider. The user's
  // provider override (when present) is forwarded so a per-agent model uses it too.
  const provider = agent.model
    ? createProvider(agent.model, undefined, undefined, providerOverride)
    : sharedProvider;

  try {
    // Re-generate when the model returns a degenerate reply (empty, trivially
    // short, or a bare label like "User Safety: safe") — such replies add
    // nothing to the discussion. A short reminder is appended on retries to
    // nudge the model back into the conversation.
    let result;
    let attempt = 0;
    while (true) {
      attempt++;
      if (signal?.aborted) throw new CouncilAbortedError();

      const retryReminder =
        attempt > 1
          ? "\n\nYour previous reply was not a usable contribution. Respond in character with a concrete point that moves the discussion forward — no labels, headers, or meta-commentary."
          : "";

      result = await provider.generate({
        systemPrompt,
        userMessage: userMessage + retryReminder,
        temperature: DISCUSSION_TEMPERATURE,
        maxTokens: DISCUSSION_MAX_TOKENS,
        signal,
      });

      if (!isDegenerateResponse(result.content) || attempt > MAX_TURN_RETRIES) {
        break;
      }

      logger.info(`Discussion turn retry: ${agent.name}`, {
        runId,
        agentId: agent.id,
        round,
        index,
        attempt,
        maxRetries: MAX_TURN_RETRIES,
        responseLength: result.content.trim().length,
      });
      await delay(TURN_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }

    const degenerate = isDegenerateResponse(result.content);
    const durationMs = Math.round(performance.now() - start);
    logger.info(`Discussion turn completed: ${agent.name}`, {
      runId,
      agentId: agent.id,
      round,
      index,
      model: result.model,
      durationMs,
      attempts: attempt,
      degenerate,
      responseLength: result.content.length,
    });

    logRawExchange({
      runId,
      agentId: agent.id,
      agentName: agent.name,
      role: "specialist",
      model: result.model,
      systemPrompt,
      userMessage,
      temperature: DISCUSSION_TEMPERATURE,
      maxTokens: DISCUSSION_MAX_TOKENS,
      response: result.content,
      durationMs,
    });

    return {
      turn: {
        round,
        index,
        agentId: agent.id,
        agentName: agent.name,
        // Keep the raw reply only when it's usable; otherwise a placeholder so
        // the transcript (and later agents' context) isn't polluted by junk.
        content: degenerate
          ? `[${agent.name} had no substantive response this turn.]`
          : result.content,
        model: result.model,
        ok: !degenerate,
      },
      durationMs,
    };
  } catch (error) {
    // Cancellation must propagate and stop the whole discussion.
    if (error instanceof CouncilAbortedError) throw error;

    const durationMs = Math.round(performance.now() - start);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`Discussion turn failed: ${agent.name}`, {
      runId,
      agentId: agent.id,
      round,
      index,
      durationMs,
      error: errorMessage,
    });

    logRawExchange({
      runId,
      agentId: agent.id,
      agentName: agent.name,
      role: "specialist",
      model: agent.model ?? "default",
      systemPrompt,
      userMessage,
      response: null,
      error: errorMessage,
      durationMs,
    });

    // Record a placeholder turn so the conversation can continue with the
    // remaining agents instead of aborting the whole run on one failure.
    return {
      turn: {
        round,
        index,
        agentId: agent.id,
        agentName: agent.name,
        content: `[${agent.name} was unable to respond this turn.]`,
        model: agent.model ?? "unknown",
        ok: false,
      },
      durationMs,
    };
  }
}

// ─── Closing summary (optional) ─────────────────────────────────────

/**
 * Runs the optional summarizer agent over the full transcript after the rounds
 * finish. Retries on a degenerate reply (same rule as turns); a failure or a
 * persistently degenerate reply yields an `ok: false` placeholder rather than
 * aborting the run.
 */
async function runSummary(
  agent: CouncilAgent,
  runId: string,
  sharedProvider: ReturnType<typeof createProvider>,
  topic: string,
  transcript: DiscussionTurn[],
  signal: AbortSignal | undefined,
  providerOverride: RunDiscussionInput["providerOverride"],
): Promise<{ summary: DiscussionSummary; durationMs: number }> {
  const start = performance.now();
  const systemPrompt = buildDiscussionSummarySystemPrompt(agent);
  const userMessage = buildDiscussionSummaryUserMessage(topic, transcript);
  const provider = agent.model
    ? createProvider(agent.model, undefined, undefined, providerOverride)
    : sharedProvider;

  try {
    let result;
    let attempt = 0;
    while (true) {
      attempt++;
      if (signal?.aborted) throw new CouncilAbortedError();
      result = await provider.generate({
        systemPrompt,
        userMessage,
        temperature: SUMMARY_TEMPERATURE,
        maxTokens: SUMMARY_MAX_TOKENS,
        signal,
      });
      if (!isDegenerateResponse(result.content) || attempt > MAX_TURN_RETRIES) {
        break;
      }
      logger.info(`Discussion summary retry: ${agent.name}`, {
        runId,
        agentId: agent.id,
        attempt,
      });
      await delay(TURN_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }

    const degenerate = isDegenerateResponse(result.content);
    const durationMs = Math.round(performance.now() - start);
    logger.info(`Discussion summary completed: ${agent.name}`, {
      runId,
      agentId: agent.id,
      model: result.model,
      durationMs,
      attempts: attempt,
      degenerate,
      responseLength: result.content.length,
    });

    logRawExchange({
      runId,
      agentId: agent.id,
      agentName: agent.name,
      role: "judge",
      model: result.model,
      systemPrompt,
      userMessage,
      temperature: SUMMARY_TEMPERATURE,
      maxTokens: SUMMARY_MAX_TOKENS,
      response: result.content,
      durationMs,
    });

    return {
      summary: {
        agentId: agent.id,
        agentName: agent.name,
        content: degenerate
          ? `[${agent.name} was unable to summarize the discussion.]`
          : result.content,
        model: result.model,
        ok: !degenerate,
      },
      durationMs,
    };
  } catch (error) {
    if (error instanceof CouncilAbortedError) throw error;

    const durationMs = Math.round(performance.now() - start);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`Discussion summary failed: ${agent.name}`, {
      runId,
      agentId: agent.id,
      durationMs,
      error: errorMessage,
    });

    logRawExchange({
      runId,
      agentId: agent.id,
      agentName: agent.name,
      role: "judge",
      model: agent.model ?? "default",
      systemPrompt,
      userMessage,
      response: null,
      error: errorMessage,
      durationMs,
    });

    return {
      summary: {
        agentId: agent.id,
        agentName: agent.name,
        content: `[${agent.name} was unable to summarize the discussion.]`,
        model: agent.model ?? "unknown",
        ok: false,
      },
      durationMs,
    };
  }
}

// ─── Main orchestrator ──────────────────────────────────────────────

/**
 * Runs a live, turn-based roundtable discussion: a small panel of agents
 * (2-4) talks back-and-forth about `topic` for a bounded number of `rounds`.
 * Within each round every agent speaks once, in selection order, seeing the
 * full transcript so far. Turns are sequential by design — each agent reacts
 * to what was said before it. Progress is streamed via `onProgress`.
 */
export async function runDiscussion(
  input: RunDiscussionInput,
): Promise<RunDiscussionResult> {
  const runId = input.runId ?? generateId();
  const overallStart = performance.now();

  validate(input);

  const topic = input.topic.trim();
  const totalRounds = input.rounds;
  const participants = resolveParticipants(input.agentIds, input.fallbackModels);
  const participantNames = participants.map((p) => p.name);

  // Resolve the optional summarizer up front so an unknown id fails fast,
  // before any model calls are made.
  let summarizer: CouncilAgent | undefined;
  if (input.summarizerId) {
    [summarizer] = resolveParticipants(
      [input.summarizerId],
      input.fallbackModels,
    );
  }

  logger.info("Discussion started", {
    runId,
    agents: participantNames,
    rounds: totalRounds,
    topicLength: topic.length,
  });

  logRawEvent(runId, "discussion_started", {
    topic,
    rounds: totalRounds,
    participants: participants.map((p) => ({
      id: p.id,
      name: p.name,
      model: p.model ?? "default",
    })),
  });

  input.onProgress?.({
    type: "discussion_started",
    participants: participants.map(toAgentMeta),
    rounds: totalRounds,
  });

  // input.providerOverride (the user's own key + provider, when present)
  // overrides LLM_PROVIDER so the discussion hits live LLMs.
  const provider = createProvider(
    undefined,
    undefined,
    undefined,
    input.providerOverride,
  );
  const transcript: DiscussionTurn[] = [];
  let index = 0;

  for (let round = 1; round <= totalRounds; round++) {
    throwIfAborted(input.signal);
    input.onProgress?.({ type: "round_started", round });

    for (const agent of participants) {
      throwIfAborted(input.signal);
      input.onProgress?.({ type: "turn_started", round, agentId: agent.id });

      const { turn, durationMs } = await runTurn(
        agent,
        runId,
        provider,
        topic,
        transcript,
        round,
        totalRounds,
        index,
        participantNames,
        input.signal,
        input.providerOverride,
      );

      transcript.push(turn);
      index++;
      input.onProgress?.({ type: "turn_completed", turn, durationMs });
    }
  }

  // Optional closing summary over the whole transcript.
  let summary: DiscussionSummary | undefined;
  if (summarizer) {
    throwIfAborted(input.signal);
    input.onProgress?.({ type: "summary_started", agentId: summarizer.id });
    const { summary: s, durationMs } = await runSummary(
      summarizer,
      runId,
      provider,
      topic,
      transcript,
      input.signal,
      input.providerOverride,
    );
    summary = s;
    input.onProgress?.({ type: "summary_completed", summary: s, durationMs });
  }

  const overallDurationMs = Math.round(performance.now() - overallStart);
  logger.info("Discussion completed", {
    runId,
    rounds: totalRounds,
    turns: transcript.length,
    summarizer: summarizer?.name ?? null,
    durationMs: overallDurationMs,
  });

  logRawEvent(runId, "discussion_completed", {
    durationMs: overallDurationMs,
    turns: transcript,
    summary: summary ?? null,
  });

  return {
    id: runId,
    topic,
    participants: participants.map(toAgentMeta),
    rounds: totalRounds,
    turns: transcript,
    summary,
    createdAt: new Date().toISOString(),
  };
}
