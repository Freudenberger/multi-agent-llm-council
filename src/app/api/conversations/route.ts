import { NextRequest, NextResponse } from "next/server";
import { createStorage } from "@/storage";
import { logger } from "@/core/logger";

const storage = createStorage();

/** GET /api/conversations — list all conversations */
export async function GET() {
  try {
    const conversations = await storage.list();
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

/** POST /api/conversations — save a new conversation */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id || !body.modeId || !body.userInput) {
      return NextResponse.json(
        { error: "Missing required fields: id, modeId, userInput" },
        { status: 400 },
      );
    }

    const title =
      body.title ||
      body.userInput.substring(0, 60) +
        (body.userInput.length > 60 ? "..." : "");

    await storage.save({
      ...body,
      title,
      createdAt: body.createdAt || new Date().toISOString(),
    });

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
