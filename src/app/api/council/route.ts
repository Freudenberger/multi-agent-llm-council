import { NextRequest, NextResponse } from "next/server";
import { runCouncil } from "@/core/runCouncil";
import { logger } from "@/core/logger";
import {
  ValidationError,
  ModeNotFoundError,
  ProviderRetryError,
  ProviderTimeoutError,
  CouncilAbortedError,
} from "@/core/errors";
import { z } from "zod";
import { auth } from "@/auth/config";
import { userStorage } from "@/auth/userStorage";
import { createStorage } from "@/storage";

const customAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(200),
  systemPrompt: z.string().min(1).max(20000),
  isFinalJudge: z.boolean().optional(),
  disabled: z.boolean().optional(),
  model: z.string().max(200).optional(),
});

const requestSchema = z.object({
  input: z
    .string()
    .min(1, "Input cannot be empty")
    .max(10000, "Input too long (max 10 000 characters)"),
  mode: z.enum([
    "decision",
    "idea",
    "criticalReview",
    "learning",
    "technical",
    "answer",
    "swot",
  ]),
  customAgents: z.record(z.string(), customAgentSchema).optional(),
  /** Opt into the peer-review/ranking phase for this run (run-level analysis option). */
  peerReview: z.boolean().optional(),
});

/** Map error types to HTTP status codes and user-friendly messages */
function errorResponse(error: unknown) {
  if (error instanceof ValidationError) {
    return {
      status: 400,
      body: {
        error: "Invalid input",
        message: error.message,
        type: "validation",
      },
    };
  }

  if (error instanceof ModeNotFoundError) {
    return {
      status: 404,
      body: {
        error: "Unknown mode",
        message: error.message,
        type: "not_found",
      },
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

  // Generic fallback
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

/** Generate a request/run id used to correlate every log line for this call. */
function generateRunId(): string {
  return `council-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function POST(request: NextRequest) {
  const start = performance.now();
  // One id for the whole request: bound onto the logger here and passed into
  // runCouncil so the API lines and the council lines share the same runId.
  const runId = generateRunId();
  const log = logger.child({ runId });
  log.info("API request received", { method: "POST", path: "/api/council" });

  // Parse JSON body
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

  // Validate input
  const validation = requestSchema.safeParse(body);
  if (!validation.success) {
    const fields = validation.error.flatten().fieldErrors;
    log.info("API validation failed", { errors: fields });
    return NextResponse.json(
      {
        error: "Validation failed",
        message: formatValidationErrors(fields),
        details: fields,
        type: "validation",
      },
      { status: 400 },
    );
  }

  log.debug("API request validated", {
    mode: validation.data.mode,
    inputLength: validation.data.input.length,
  });

  // Resolve the signed-in user once: their preferred models become the
  // allow-list that agents without an explicit override are randomly assigned
  // from, and we reuse the same session below to persist the conversation.
  const session = await auth();
  let fallbackModels: string[] | undefined;
  if (session?.user?.id) {
    const user = await userStorage.findById(session.user.id);
    fallbackModels = user?.preferredModels;
  }

  // Run the council and stream progress + the final result as NDJSON.
  // Each line is one JSON object tagged by `kind`:
  //   { kind: "progress", event }  — live status (run/phase/agent events)
  //   { kind: "result", result }   — the final RunCouncilResult
  //   { kind: "error", error }     — a fatal error (same shape as the JSON API)
  // The client aborting the request cancels the run via `ac`.
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
        const result = await runCouncil({
          runId,
          input: validation.data.input,
          mode: validation.data.mode,
          customAgents: validation.data.customAgents,
          peerReview: validation.data.peerReview,
          fallbackModels,
          signal: ac.signal,
          onProgress: (event) => send({ kind: "progress", event }),
        });

        const durationMs = Math.round(performance.now() - start);
        log.info("API request completed", {
          mode: result.modeId,
          durationMs,
          agentCount: result.agentResponses.length,
          confidence: result.finalReport.confidence,
        });

        // Save to storage only if user is authenticated
        if (session?.user?.id) {
          const storage = createStorage();
          const title =
            validation.data.input.substring(0, 60) +
            (validation.data.input.length > 60 ? "..." : "");
          await storage.save({
            ...result,
            userId: session.user.id,
            title,
          });
          log.info("Conversation saved for user", {
            userId: session.user.id,
          });
        }

        send({ kind: "result", result });
      } catch (error) {
        const durationMs = Math.round(performance.now() - start);

        if (error instanceof CouncilAbortedError || ac.signal.aborted) {
          log.info("Council run cancelled", { runId, durationMs });
          // The client has gone away; nothing to send.
        } else {
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
      // Reader cancelled (e.g. client disconnected) — stop the run.
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

/** Convert zod field errors into a human-readable summary */
function formatValidationErrors(fields: Record<string, string[]>): string {
  const messages: string[] = [];
  for (const [field, errors] of Object.entries(fields)) {
    for (const err of errors) {
      messages.push(`${field}: ${err}`);
    }
  }
  return messages.join("; ");
}
