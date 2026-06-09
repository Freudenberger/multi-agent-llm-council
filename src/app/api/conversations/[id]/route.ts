import { NextRequest, NextResponse } from "next/server";
import { createStorage } from "@/storage";
import { auth } from "@/auth/config";
import { logger } from "@/core/logger";

const storage = createStorage();

/** GET /api/conversations/:id — get a single conversation (owner only) */
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
    const conversation = await storage.get(id);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    // Only the owner can access
    if (conversation.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    logger.error("Failed to get conversation", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to get conversation" },
      { status: 500 },
    );
  }
}

/** DELETE /api/conversations/:id — delete a conversation (owner only) */
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

    // Verify ownership before deleting
    const conversation = await storage.get(id);
    if (conversation && conversation.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await storage.delete(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Failed to delete conversation", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 },
    );
  }
}
