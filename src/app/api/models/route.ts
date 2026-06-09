import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/core/logger";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedModels: { data: ModelInfo[]; fetchedAt: number } | null = null;

export type ModelInfo = {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  contextLength: number;
  free: boolean;
};

function isFreeModel(pricing: { prompt: string; completion: string }): boolean {
  return pricing.prompt === "0" && pricing.completion === "0";
}

export async function GET() {
  // Return cached data if fresh
  if (cachedModels && Date.now() - cachedModels.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      models: cachedModels.data,
      cached: true,
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    logger.info("OPENROUTER_API_KEY not set, returning empty model list");
    return NextResponse.json({ models: [], cached: false });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      logger.error("OpenRouter models API error", { status: response.status });
      return NextResponse.json(
        { error: "Failed to fetch models", models: [] },
        { status: 502 },
      );
    }

    const data = await response.json();
    const models: ModelInfo[] = (data.data || [])
      .filter((m: any) => isFreeModel(m.pricing || {}))
      .map((m: any) => ({
        id: m.id,
        name: m.id.split("/").pop() || m.id,
        description: m.description || "",
        pricing: {
          prompt: m.pricing?.prompt || "0",
          completion: m.pricing?.completion || "0",
        },
        contextLength: m.context_length || 0,
        free: true,
      }))
      .sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id));

    cachedModels = { data: models, fetchedAt: Date.now() };
    logger.info("Fetched free models from OpenRouter", { count: models.length });

    return NextResponse.json({ models, cached: false });
  } catch (error) {
    logger.error("Failed to fetch models", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to fetch models", models: [] },
      { status: 500 },
    );
  }
}
