import { NextRequest, NextResponse } from "next/server";
import { createDiscussionStorage } from "@/storage/discussionStorage";
import { auth } from "@/auth/config";
import { logger } from "@/core/logger";

const storage = createDiscussionStorage();

/** GET /api/discussions — list the logged-in user's saved discussions. */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(await storage.list(session.user.id));
  } catch (error) {
    logger.error("Failed to list discussions", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to list discussions" }, { status: 500 });
  }
}

/** POST /api/discussions — save (upsert) a discussion for the logged-in user. */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    if (!body.id || !body.topic) {
      return NextResponse.json(
        { error: "Missing required fields: id, topic" },
        { status: 400 },
      );
    }

    await storage.save({
      id: body.id,
      userId: session.user.id,
      createdAt: body.createdAt || new Date().toISOString(),
      topic: body.topic,
      participants: body.participants ?? [],
      rounds: body.rounds ?? 0,
      turns: body.turns ?? [],
      summary: body.summary ?? null,
      phase: body.phase ?? "done",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Failed to save discussion", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to save discussion" }, { status: 500 });
  }
}
