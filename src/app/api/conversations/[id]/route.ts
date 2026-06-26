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
    // Ownership is enforced by the contract: getOwned returns null for both
    // not-found and not-owned, so the two collapse to one 404 (no enumeration).
    const conversation = await storage.getOwned(id, session.user.id);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
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

    // Only delete what the caller owns; not-found and not-owned both → 404.
    const conversation = await storage.getOwned(id, session.user.id);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
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
