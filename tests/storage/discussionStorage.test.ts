import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createDiscussionStorage } from "@/storage/discussionStorage";
import type { StoredDiscussion } from "@/storage/types";
import { MAX_DISCUSSIONS_PER_USER } from "@/config";

// DB_PROVIDER defaults to local, so createDiscussionStorage() returns the
// JSON-file provider here.
const storage = createDiscussionStorage();
const DATA_DIR = path.join(process.cwd(), "data", "discussions");

function makeDiscussion(
  id: string,
  userId: string,
  overrides?: Partial<StoredDiscussion>,
): StoredDiscussion {
  return {
    id,
    userId,
    createdAt: new Date().toISOString(),
    topic: `Topic for ${id}`,
    participants: [],
    rounds: 2,
    turns: [
      { index: 0, round: 1, agentId: "a", agentName: "A", model: "m", content: "hi", ok: true },
    ],
    summary: null,
    phase: "done",
    ...overrides,
  };
}

function cleanup() {
  if (!fs.existsSync(DATA_DIR)) return;
  for (const f of fs.readdirSync(DATA_DIR)) {
    if (f.startsWith("test-")) fs.unlinkSync(path.join(DATA_DIR, f));
  }
}

describe("discussionStorage (local file provider)", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("saves, lists, and gets a discussion", async () => {
    await storage.save(makeDiscussion("test-a", "user-1"));

    const list = await storage.list("user-1");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "test-a", turnCount: 1, phase: "done" });

    const full = await storage.get("test-a");
    expect(full?.topic).toBe("Topic for test-a");
    expect(full?.userId).toBe("user-1");
  });

  it("scopes listing to the owner", async () => {
    await storage.save(makeDiscussion("test-mine", "user-1"));
    await storage.save(makeDiscussion("test-theirs", "user-2"));

    expect(await storage.list("user-1")).toHaveLength(1);
    expect((await storage.list("user-1"))[0].id).toBe("test-mine");
  });

  it("upserts in place without evicting (same id re-saved)", async () => {
    await storage.save(makeDiscussion("test-up", "user-1", { topic: "first" }));
    await storage.save(makeDiscussion("test-up", "user-1", { topic: "second" }));

    const list = await storage.list("user-1");
    expect(list).toHaveLength(1);
    expect((await storage.get("test-up"))?.topic).toBe("second");
  });

  it(`enforces the ${MAX_DISCUSSIONS_PER_USER}-discussion cap, dropping the oldest`, async () => {
    for (let i = 0; i <= MAX_DISCUSSIONS_PER_USER; i++) {
      await storage.save(
        makeDiscussion(`test-cap-${i}`, "user-cap", {
          createdAt: new Date(Date.now() + i * 1000).toISOString(),
        }),
      );
    }
    const list = await storage.list("user-cap");
    expect(list).toHaveLength(MAX_DISCUSSIONS_PER_USER);
    expect(await storage.get("test-cap-0")).toBeNull();
  });

  it("deletes a discussion", async () => {
    await storage.save(makeDiscussion("test-del", "user-1"));
    await storage.delete("test-del");
    expect(await storage.get("test-del")).toBeNull();
  });
});
