import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { localStorage } from "@/storage/localStorage";
import type { StoredConversation } from "@/storage/types";

const DATA_DIR = path.join(process.cwd(), "data", "conversations");

function makeConversation(
  id: string,
  userId: string,
  overrides?: Partial<StoredConversation>,
): StoredConversation {
  return {
    id,
    modeId: "decision",
    userInput: `Test input for ${id}`,
    agentResponses: [
      { agentId: "a1", agentName: "Agent 1", content: "Response 1", confidence: 4 },
    ],
    judgeResponse: null,
    finalReport: {
      summary: `Summary for ${id}`,
      keyConclusions: ["c1"],
      agreements: ["a1"],
      disagreements: [],
      risks: [],
      recommendations: ["r1"],
      confidence: 3,
    },
    createdAt: new Date().toISOString(),
    title: `Title ${id}`,
    userId,
    ...overrides,
  };
}

function cleanupTestFiles() {
  if (fs.existsSync(DATA_DIR)) {
    const files = fs.readdirSync(DATA_DIR);
    for (const f of files) {
      if (f.startsWith("test-")) {
        fs.unlinkSync(path.join(DATA_DIR, f));
      }
    }
  }
}

describe("localStorage", () => {
  beforeEach(() => {
    cleanupTestFiles();
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  describe("save", () => {
    it("should save a conversation to a JSON file", async () => {
      const conv = makeConversation("test-save-1", "user-1");
      await localStorage.save(conv);

      const filePath = path.join(DATA_DIR, "test-save-1.json");
      expect(fs.existsSync(filePath)).toBe(true);

      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as StoredConversation;
      expect(parsed.id).toBe("test-save-1");
      expect(parsed.userId).toBe("user-1");
      expect(parsed.title).toBe("Title test-save-1");
    });

    it("should enforce max 5 conversations per user", async () => {
      // Save 5 conversations
      for (let i = 1; i <= 5; i++) {
        const conv = makeConversation(`test-limit-${i}`, "user-limit", {
          createdAt: new Date(Date.now() + i * 1000).toISOString(),
        });
        await localStorage.save(conv);
      }

      const list = await localStorage.list("user-limit");
      expect(list).toHaveLength(5);

      // Save a 6th — should evict the oldest
      const conv6 = makeConversation("test-limit-6", "user-limit", {
        createdAt: new Date(Date.now() + 6000).toISOString(),
      });
      await localStorage.save(conv6);

      const updated = await localStorage.list("user-limit");
      expect(updated).toHaveLength(5);
      // Oldest (test-limit-1) should be gone
      expect(updated.find((c) => c.id === "test-limit-1")).toBeUndefined();
      // Newest should be present
      expect(updated.find((c) => c.id === "test-limit-6")).toBeDefined();
    });

    it("should not affect other users' conversations when enforcing limit", async () => {
      for (let i = 1; i <= 3; i++) {
        await localStorage.save(
          makeConversation(`test-other-a-${i}`, "user-a", {
            createdAt: new Date(Date.now() + i * 1000).toISOString(),
          }),
        );
      }
      for (let i = 1; i <= 3; i++) {
        await localStorage.save(
          makeConversation(`test-other-b-${i}`, "user-b", {
            createdAt: new Date(Date.now() + i * 1000).toISOString(),
          }),
        );
      }

      // Add a 4th for user-a
      await localStorage.save(
        makeConversation("test-other-a-4", "user-a", {
          createdAt: new Date(Date.now() + 4000).toISOString(),
        }),
      );

      const listA = await localStorage.list("user-a");
      const listB = await localStorage.list("user-b");
      expect(listA).toHaveLength(5); // 3 original + 1 new + 1 evicted
      expect(listB).toHaveLength(3);
    });
  });

  describe("list", () => {
    it("should return empty array for unknown user", async () => {
      const result = await localStorage.list("no-such-user");
      expect(result).toEqual([]);
    });

    it("should return only conversations for the specified user", async () => {
      await localStorage.save(makeConversation("test-list-1", "user-1"));
      await localStorage.save(makeConversation("test-list-2", "user-2"));
      await localStorage.save(makeConversation("test-list-3", "user-1"));

      const result = await localStorage.list("user-1");
      expect(result).toHaveLength(2);
      expect(result.every((c) => c.id.startsWith("test-list"))).toBe(true);
      const ids = result.map((c) => c.id);
      expect(ids).toContain("test-list-1");
      expect(ids).toContain("test-list-3");
    });

    it("should return conversations newest-first", async () => {
      await localStorage.save(
        makeConversation("test-sort-1", "user-sort", {
          createdAt: "2026-01-01T00:00:00Z",
        }),
      );
      await localStorage.save(
        makeConversation("test-sort-2", "user-sort", {
          createdAt: "2026-06-01T00:00:00Z",
        }),
      );
      await localStorage.save(
        makeConversation("test-sort-3", "user-sort", {
          createdAt: "2026-03-01T00:00:00Z",
        }),
      );

      const result = await localStorage.list("user-sort");
      expect(result[0].id).toBe("test-sort-2");
      expect(result[1].id).toBe("test-sort-3");
      expect(result[2].id).toBe("test-sort-1");
    });

    it("should return summaries without full response content", async () => {
      await localStorage.save(makeConversation("test-sum-1", "user-sum"));
      const result = await localStorage.list("user-sum");

      expect(result).toHaveLength(1);
      const summary = result[0];
      expect(summary.id).toBe("test-sum-1");
      expect(summary.title).toBe("Title test-sum-1");
      expect(summary.modeId).toBe("decision");
      expect(summary.createdAt).toBeDefined();
      expect(summary.messageCount).toBe(1);
    });

    it("should skip corrupt files gracefully", async () => {
      // Ensure dir exists
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(DATA_DIR, "test-corrupt.json"),
        "not valid json{{{",
      );
      await localStorage.save(makeConversation("test-good", "user-corrupt"));

      const result = await localStorage.list("user-corrupt");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("test-good");
    });
  });

  describe("get", () => {
    it("should return null for non-existent ID", async () => {
      const result = await localStorage.get("does-not-exist");
      expect(result).toBeNull();
    });

    it("should return the full conversation by ID", async () => {
      const conv = makeConversation("test-get-1", "user-get");
      await localStorage.save(conv);

      const result = await localStorage.get("test-get-1");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("test-get-1");
      expect(result!.userId).toBe("user-get");
      expect(result!.userInput).toBe("Test input for test-get-1");
      expect(result!.agentResponses).toHaveLength(1);
      expect(result!.finalReport.summary).toBe("Summary for test-get-1");
    });
  });

  describe("delete", () => {
    it("should delete a conversation by ID", async () => {
      await localStorage.save(makeConversation("test-del-1", "user-del"));
      expect(
        fs.existsSync(path.join(DATA_DIR, "test-del-1.json")),
      ).toBe(true);

      await localStorage.delete("test-del-1");
      expect(
        fs.existsSync(path.join(DATA_DIR, "test-del-1.json")),
      ).toBe(false);
    });

    it("should not throw when deleting non-existent ID", async () => {
      await expect(
        localStorage.delete("does-not-exist"),
      ).resolves.not.toThrow();
    });

    it("should only delete the specified conversation", async () => {
      await localStorage.save(makeConversation("test-del-a", "user-del"));
      await localStorage.save(makeConversation("test-del-b", "user-del"));

      await localStorage.delete("test-del-a");

      const list = await localStorage.list("user-del");
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe("test-del-b");
    });
  });
});
