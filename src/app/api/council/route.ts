import { NextRequest, NextResponse } from "next/server";
import { runCouncil } from "@/core/runCouncil";
import { logger } from "@/core/logger";
import { z } from "zod";

const requestSchema = z.object({
  input: z
    .string()
    .min(1, "Input cannot be empty")
    .max(10000, "Input too long"),
  mode: z.enum(["decision", "idea", "criticalReview", "learning", "technical", "answer"]),
});

export async function POST(request: NextRequest) {
  const start = performance.now();
  logger.info("API request received", { method: "POST", path: "/api/council" });

  try {
    const body = await request.json();

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      logger.info("API validation failed", {
        errors: validation.error.flatten().fieldErrors,
      });
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 },
      );
    }

    logger.debug("API request validated", {
      mode: validation.data.mode,
      inputLength: validation.data.input.length,
    });

    const result = await runCouncil({
      input: validation.data.input,
      mode: validation.data.mode,
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
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorName = error instanceof Error ? error.name : "Error";

    logger.error("API request failed", {
      durationMs,
      error: errorMessage,
      errorName,
    });

    if (error instanceof Error) {
      if (error.name === "ValidationError") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.name === "ModeNotFoundError") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "LLM Council API is running",
    endpoints: {
      POST: "/api/council — Run a council analysis",
    },
  });
}
