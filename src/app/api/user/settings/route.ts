import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth/config";
import { userStorage } from "@/auth/userStorage";
import type { ProviderSettings, ProviderSetting } from "@/auth/types";
import { logger } from "@/core/logger";

const AVAILABLE_PROVIDERS = [
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access to multiple LLM models through OpenRouter API",
    docsUrl: "https://openrouter.ai/keys",
  },
] as const;

const settingsSchema = z
  .object({
    providerSettings: z
      .record(
        z.string(),
        z.object({
          apiKey: z.string().min(1, "API key cannot be empty").max(500),
        }),
      )
      .optional(),
    /** Preferred model ids in priority order; index 0 is the default model. */
    preferredModels: z.array(z.string().min(1).max(200)).max(50).optional(),
  })
  .refine(
    (data) =>
      data.providerSettings !== undefined || data.preferredModels !== undefined,
    { message: "Provide providerSettings and/or preferredModels" },
  );

const testApiKeySchema = z.object({
  apiKey: z.string().min(1, "API key cannot be empty").max(500).optional(),
});

/**
 * GET /api/user/settings
 * Returns the current user's provider settings (API keys are masked)
 * and the list of available providers.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await userStorage.findById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Mask API keys for security — only show last 4 chars
  const maskedSettings: ProviderSettings = {};
  if (user.providerSettings) {
    for (const [providerId, setting] of Object.entries(user.providerSettings)) {
      maskedSettings[providerId] = {
        apiKey:
          setting.apiKey.length > 4
            ? "*".repeat(setting.apiKey.length / 4)
            : "****",
      };
    }
  }

  return NextResponse.json({
    providers: AVAILABLE_PROVIDERS,
    settings: maskedSettings,
    preferredModels: user.preferredModels ?? [],
  });
}

/**
 * PUT /api/user/settings
 * Updates the current user's provider settings.
 */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await userStorage.findById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // Merge provider settings (API keys) when supplied
  if (parsed.data.providerSettings) {
    const existingSettings = user.providerSettings ?? {};
    const mergedSettings: ProviderSettings = { ...existingSettings };
    for (const [providerId, setting] of Object.entries(
      parsed.data.providerSettings,
    )) {
      mergedSettings[providerId] = setting as ProviderSetting;
    }

    const updated = await userStorage.updateProviderSettings(
      session.user.id,
      mergedSettings,
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 },
      );
    }

    logger.info("Provider settings updated via API", {
      userId: session.user.id,
      providers: Object.keys(parsed.data.providerSettings),
    });
  }

  // Persist preferred models when supplied (empty array clears them)
  if (parsed.data.preferredModels) {
    const updated = await userStorage.updatePreferredModels(
      session.user.id,
      parsed.data.preferredModels,
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update preferred models" },
        { status: 500 },
      );
    }

    logger.info("Preferred models updated via API", {
      userId: session.user.id,
      count: parsed.data.preferredModels.length,
    });
  }

  return NextResponse.json({ message: "Settings updated successfully" });
}

/**
 * DELETE /api/user/settings?provider=<providerId>
 * Removes a specific provider's API key.
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await userStorage.findById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const providerId = request.nextUrl.searchParams.get("provider");
  if (!providerId) {
    return NextResponse.json(
      { error: "Provider ID is required" },
      { status: 400 },
    );
  }

  const existingSettings = user.providerSettings ?? {};
  if (!existingSettings[providerId]) {
    return NextResponse.json(
      { error: "No API key configured for this provider" },
      { status: 404 },
    );
  }

  const updatedSettings: ProviderSettings = { ...existingSettings };
  delete updatedSettings[providerId];

  const updated = userStorage.updateProviderSettings(
    session.user.id,
    updatedSettings,
  );
  if (!updated) {
    return NextResponse.json(
      { error: "Failed to remove API key" },
      { status: 500 },
    );
  }

  logger.info("Provider API key removed", {
    userId: session.user.id,
    providerId,
  });

  return NextResponse.json({ message: "API key removed successfully" });
}

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

  const user = await userStorage.findById(session.user.id);
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
  const providerSetting = existingSettings[providerId];
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
