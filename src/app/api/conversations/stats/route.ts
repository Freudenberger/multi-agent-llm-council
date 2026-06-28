import { NextResponse } from "next/server";
import { createStorage } from "@/storage";
import { auth } from "@/auth/config";
import { logger } from "@/core/logger";
import { aggregateModelStats } from "@/core/modelStats";

const storage = createStorage();

// GET /api/conversations/stats — per-model comparison for the logged-in user,
// aggregated across their saved council runs. Powers the /dashboard page.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // list() returns summaries only, so load each run for its agentResponses.
    // Bounded by MAX_CONVERSATIONS_PER_USER, so this stays a handful of reads.
    const summaries = await storage.list(session.user.id);
    const runs = await Promise.all(
      summaries.map((s) => storage.getOwned(s.id, session.user!.id)),
    );

    const stats = aggregateModelStats(runs.filter((r) => r !== null));
    return NextResponse.json({ stats, conversationCount: summaries.length });
  } catch (error) {
    logger.error("Failed to compute model stats", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to compute model stats" },
      { status: 500 },
    );
  }
}
