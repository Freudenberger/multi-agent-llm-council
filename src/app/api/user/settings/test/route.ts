import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth/config";
import { userStorage } from "@/auth/userStorage";
import { logger } from "@/core/logger";

type ProviderSetting = {
  apiKey: string;
};

const testApiKeySchema = z.object({
  apiKey: z.string().min(1, "API key cannot be empty").max(500).optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providerId = request.nextUrl.searchParams.get("provider");
  if (!providerId) {
    return NextResponse.json(
      { error: "Provider ID is required" },
      { status: 400 },
    );
  }

  const user = userStorage.findById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = testApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const existingSettings = user.providerSettings ?? {};
  const providerSetting = existingSettings[providerId] as
    | ProviderSetting
    | undefined;
  const apiKey = parsed.data.apiKey?.trim() || providerSetting?.apiKey;

  if (!apiKey) {
    return NextResponse.json(
      { error: "No API key configured for this provider" },
      { status: 400 },
    );
  }

  switch (providerId) {
    case "openrouter":
      return await validateOpenRouterApiKey(apiKey);
    default:
      return NextResponse.json(
        { error: `Provider '${providerId}' is not supported` },
        { status: 400 },
      );
  }
}

async function validateOpenRouterApiKey(apiKey: string) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 401 || response.status === 403) {
      return NextResponse.json(
        { error: "Invalid OpenRouter API key" },
        { status: 401 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `OpenRouter validation failed: ${response.status}` },
        { status: 502 },
      );
    }

    return NextResponse.json({
      message: `API key is valid.`,
    });
  } catch (error) {
    logger.error("OpenRouter validation error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to validate OpenRouter API key" },
      { status: 502 },
    );
  }
}
