import { NextRequest, NextResponse } from "next/server";
import { runCouncil } from "@/core/runCouncil";
import { logger } from "@/core/logger";
import {
  ValidationError,
  ModeNotFoundError,
  ProviderRetryError,
  ProviderTimeoutError,
} from "@/core/errors";
import { z } from "zod";

const customAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(200),
  systemPrompt: z.string().min(1).max(20000),
  isFinalJudge: z.boolean().optional(),
  disabled: z.boolean().optional(),
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
  ]),
  customAgents: z.record(z.string(), customAgentSchema).optional(),
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

export async function POST(request: NextRequest) {
  const start = performance.now();
  logger.info("API request received", { method: "POST", path: "/api/council" });

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
    logger.info("API validation failed", { errors: fields });
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

  logger.debug("API request validated", {
    mode: validation.data.mode,
    inputLength: validation.data.input.length,
  });

  // Run council
  try {
    const result = await runCouncil({
      input: validation.data.input,
      mode: validation.data.mode,
      customAgents: validation.data.customAgents,
    });

    const durationMs = Math.round(performance.now() - start);
    logger.info("API request completed", {
      runId: result.id,
      mode: result.modeId,
      durationMs,
      agentCount: result.agentResponses.length,
      confidence: result.finalReport.confidence,
    });

    return NextResponse.json(result);
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    const { status, body: errorBody } = errorResponse(error);

    logger.error("API request failed", {
      durationMs,
      status,
      error: errorBody.error,
      type: errorBody.type,
      originalError: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(errorBody, { status });
  }
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
