import { NextRequest, NextResponse } from "next/server";
import { runDiscussion } from "@/core/runDiscussion";
import { logger } from "@/core/logger";
import {
  ValidationError,
  ProviderRetryError,
  ProviderTimeoutError,
  CouncilAbortedError,
} from "@/core/errors";
import {
  DISCUSSION_MIN_AGENTS,
  DISCUSSION_MAX_AGENTS,
  DISCUSSION_MIN_ROUNDS,
  DISCUSSION_MAX_ROUNDS,
} from "@/core/types";
import { z } from "zod";
import { auth } from "@/auth/config";
import { userStorage } from "@/auth/userStorage";
import { resolveProviderOverride } from "@/auth/providerOverride";
import { incr, observeDuration } from "@/core/metrics";

const requestSchema = z.object({
  topic: z
    .string()
    .min(1, "Topic cannot be empty")
    .max(10000, "Topic too long (max 10 000 characters)"),
  agentIds: z
    .array(z.string().min(1))
    .min(DISCUSSION_MIN_AGENTS, `Select at least ${DISCUSSION_MIN_AGENTS} agents`)
    .max(DISCUSSION_MAX_AGENTS, `Select at most ${DISCUSSION_MAX_AGENTS} agents`),
  rounds: z
    .number()
    .int()
    .min(DISCUSSION_MIN_ROUNDS)
    .max(DISCUSSION_MAX_ROUNDS),
  /** Optional agent-template id that summarizes the discussion at the end. */
  summarizerId: z.string().min(1).optional(),
});

/** Map error types to HTTP status codes and user-friendly messages. */
function errorResponse(error: unknown) {
  if (error instanceof ValidationError) {
    return {
      status: 400,
      body: { error: "Invalid input", message: error.message, type: "validation" },
    };
  }
  if (error instanceof ProviderTimeoutError) {
    return {
      status: 504,
      body: {
        error: "Request timed out",
        message:
          "The AI provider took too long to respond. Please try again in a moment.",
        type: "timeout",
        retryable: true,
      },
    };
  }
  if (error instanceof ProviderRetryError) {
    return {
      status: 503,
      body: {
        error: "Service temporarily unavailable",
        message:
          "The AI provider is currently unavailable after multiple retries. Please try again later.",
        type: "provider_unavailable",
        retryable: true,
      },
    };
  }
  return {
    status: 500,
    body: {
      error: "Unexpected error",
      message: "An unexpected error occurred. Please try again.",
      type: "server_error",
      retryable: true,
    },
  };
}

function generateRunId(): string {
  return `discussion-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function POST(request: NextRequest) {
  const start = performance.now();
  const runId = generateRunId();
  const log = logger.child({ runId });
  log.info("API request received", { method: "POST", path: "/api/discuss" });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request",
        message: "Request body must be valid JSON.",
        type: "validation",
      },
      { status: 400 },
    );
  }

  const validation = requestSchema.safeParse(body);
  if (!validation.success) {
    const fields = validation.error.flatten().fieldErrors;
    log.info("API validation failed", { errors: fields });
    return NextResponse.json(
      {
        error: "Validation failed",
        message: Object.entries(fields)
          .flatMap(([field, errors]) =>
            (errors ?? []).map((e) => `${field}: ${e}`),
          )
          .join("; "),
        details: fields,
        type: "validation",
      },
      { status: 400 },
    );
  }

  // The roundtable is restricted to signed-in users.
  const session = await auth();
  if (!session?.user?.id) {
    log.info("API request rejected — unauthenticated");
    return NextResponse.json(
      {
        error: "Authentication required",
        message: "Please sign in to use the Agent Roundtable.",
        type: "unauthorized",
      },
      { status: 401 },
    );
  }

  // Reuse the signed-in user's preferred models as the per-agent fallback list.
  const user = await userStorage.findById(session.user.id);
  const fallbackModels: string[] | undefined = user?.preferredModels;
  // The user's own provider key (when saved) forces live LLMs, overriding
  // LLM_PROVIDER=mock.
  const providerOverride = resolveProviderOverride(user?.providerSettings);

  // Stream progress + the final result as NDJSON, one JSON object per line:
  //   { kind: "progress", event }  — live discussion events (turn-by-turn)
  //   { kind: "result", result }   — the final RunDiscussionResult
  //   { kind: "error", error }     — a fatal error
  const encoder = new TextEncoder();
  const ac = new AbortController();
  const onClientAbort = () => ac.abort();
  request.signal.addEventListener("abort", onClientAbort);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          // Stream already closed/cancelled — drop the event.
        }
      };

      try {
        const result = await runDiscussion({
          runId,
          topic: validation.data.topic,
          agentIds: validation.data.agentIds,
          rounds: validation.data.rounds,
          summarizerId: validation.data.summarizerId,
          fallbackModels,
          providerOverride,
          signal: ac.signal,
          onProgress: (event) => send({ kind: "progress", event }),
        });

        const durationMs = Math.round(performance.now() - start);
        incr("discussion_runs_total", { status: "ok" });
        observeDuration("discussion_run_duration_ms", durationMs);
        log.info("API request completed", {
          durationMs,
          turns: result.turns.length,
          rounds: result.rounds,
        });

        send({ kind: "result", result });
      } catch (error) {
        const durationMs = Math.round(performance.now() - start);
        if (error instanceof CouncilAbortedError || ac.signal.aborted) {
          incr("discussion_runs_total", { status: "cancelled" });
          log.info("Discussion cancelled", { runId, durationMs });
        } else {
          incr("discussion_runs_total", { status: "error" });
          const { status, body: errorBody } = errorResponse(error);
          log.error("API request failed", {
            durationMs,
            status,
            error: errorBody.error,
            type: errorBody.type,
            originalError:
              error instanceof Error ? error.message : String(error),
          });
          send({ kind: "error", error: errorBody });
        }
      } finally {
        request.signal.removeEventListener("abort", onClientAbort);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
    cancel() {
      ac.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
