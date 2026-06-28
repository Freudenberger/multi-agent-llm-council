import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createDiscussionStorage } from "@/storage/discussionStorage";
import type { DiscussionPhase } from "@/storage/types";
import type {
  CouncilAgentMeta,
  DiscussionTurn,
  DiscussionSummary,
} from "@/core/types";
import { auth } from "@/auth/config";
import { logger } from "@/core/logger";

const storage = createDiscussionStorage();

// Only id + topic are required; the rest default. Shapes (participants, turns,
// summary) are stored as-is, so they're accepted loosely rather than re-modeled.
const saveSchema = z.object({
  id: z.string().min(1).max(200),
  topic: z.string().min(1).max(20000),
  createdAt: z.string().max(40).optional(),
  participants: z.array(z.unknown()).optional(),
  rounds: z.number().int().nonnegative().optional(),
  turns: z.array(z.unknown()).optional(),
  summary: z.unknown().optional(),
  phase: z.string().max(40).optional(),
});

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

    const parsed = saveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid discussion", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const body = parsed.data;

    await storage.save({
      id: body.id,
      userId: session.user.id,
      createdAt: body.createdAt || new Date().toISOString(),
      topic: body.topic,
      participants: (body.participants ?? []) as CouncilAgentMeta[],
      rounds: body.rounds ?? 0,
      turns: (body.turns ?? []) as DiscussionTurn[],
      summary: (body.summary ?? null) as DiscussionSummary | null,
      phase: (body.phase ?? "done") as DiscussionPhase,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Failed to save discussion", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to save discussion" }, { status: 500 });
  }
}
