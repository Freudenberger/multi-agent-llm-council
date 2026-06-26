import { NextRequest, NextResponse } from "next/server";
import { createDiscussionStorage } from "@/storage/discussionStorage";
import { auth } from "@/auth/config";
import { logger } from "@/core/logger";

const storage = createDiscussionStorage();

/** GET /api/discussions/:id — full discussion transcript (owner only). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    // getOwned collapses not-found and not-owned to null → one 404 path.
    const discussion = await storage.getOwned(id, session.user.id);
    if (!discussion) {
      return NextResponse.json({ error: "Discussion not found" }, { status: 404 });
    }

    return NextResponse.json(discussion);
  } catch (error) {
    logger.error("Failed to get discussion", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to get discussion" }, { status: 500 });
  }
}

/** DELETE /api/discussions/:id — delete a discussion (owner only). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const discussion = await storage.getOwned(id, session.user.id);
    if (!discussion) {
      return NextResponse.json({ error: "Discussion not found" }, { status: 404 });
    }

    await storage.delete(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Failed to delete discussion", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to delete discussion" }, { status: 500 });
  }
}
