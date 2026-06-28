import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createStorage } from "@/storage";
import type { StoredConversation } from "@/storage/types";
import { auth } from "@/auth/config";
import { logger } from "@/core/logger";

const storage = createStorage();

// Validate the fields the route relies on; passthrough keeps the rest of the
// council result (agentResponses, finalReport, …) so it's persisted intact.
const saveSchema = z
  .object({
    id: z.string().min(1).max(200),
    modeId: z.string().min(1).max(100),
    userInput: z.string().min(1).max(20000),
    title: z.string().max(300).optional(),
    createdAt: z.string().max(40).optional(),
  })
  .passthrough();

/** GET /api/conversations — list conversations for logged-in user */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversations = await storage.list(session.user.id);
    return NextResponse.json(conversations);
  } catch (error) {
    logger.error("Failed to list conversations", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to list conversations" },
      { status: 500 },
    );
  }
}

/** POST /api/conversations — save a conversation (logged-in users only) */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = saveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid conversation", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const body = parsed.data;

    const title =
      body.title ||
      body.userInput.substring(0, 60) +
        (body.userInput.length > 60 ? "..." : "");

    // Validated for the required fields; the rest is the council result the
    // client echoes back, persisted as-is.
    await storage.save({
      ...body,
      title,
      userId: session.user.id,
      createdAt: body.createdAt || new Date().toISOString(),
    } as StoredConversation);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Failed to save conversation", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to save conversation" },
      { status: 500 },
    );
  }
}
