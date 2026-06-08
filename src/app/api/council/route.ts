import { NextRequest, NextResponse } from "next/server";
import { runCouncil } from "@/core/runCouncil";
import { z } from "zod";

const requestSchema = z.object({
  input: z
    .string()
    .min(1, "Input cannot be empty")
    .max(10000, "Input too long"),
  mode: z.enum(["decision", "idea", "criticalReview", "learning", "technical"]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const result = await runCouncil({
      input: validation.data.input,
      mode: validation.data.mode,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Council API error:", error);

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
