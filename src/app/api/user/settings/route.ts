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

const settingsSchema = z.object({
  providerSettings: z.record(
    z.string(),
    z.object({
      apiKey: z.string().min(1, "API key cannot be empty").max(500),
    }),
  ),
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

  const user = userStorage.findById(session.user.id);
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
            ? "*".repeat(setting.apiKey.length - 4) + setting.apiKey.slice(-4)
            : "****",
      };
    }
  }

  return NextResponse.json({
    providers: AVAILABLE_PROVIDERS,
    settings: maskedSettings,
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

  const user = userStorage.findById(session.user.id);
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

  // Merge new settings with existing ones
  const existingSettings = user.providerSettings ?? {};
  const mergedSettings: ProviderSettings = { ...existingSettings };
  for (const [providerId, setting] of Object.entries(
    parsed.data.providerSettings,
  )) {
    mergedSettings[providerId] = setting as ProviderSetting;
  }

  const updated = userStorage.updateProviderSettings(
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

  const user = userStorage.findById(session.user.id);
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
