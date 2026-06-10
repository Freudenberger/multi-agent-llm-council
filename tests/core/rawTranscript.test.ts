import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  logRawExchange,
  logRawEvent,
  isRawLogEnabled,
} from "@/core/rawTranscript";
import type { RawExchange } from "@/core/rawTranscript";

const ENV_KEYS = [
  "COUNCIL_RAW_LOG",
  "COUNCIL_RAW_LOG_DIR",
  "COUNCIL_RAW_LOG_FORMAT",
] as const;

function makeEntry(over: Partial<RawExchange> = {}): RawExchange {
  return {
    runId: "council-test-1",
    agentId: "optimist",
    agentName: "Optimist",
    role: "specialist",
    model: "mock-provider",
    systemPrompt: "You are the Optimist.",
    userMessage: "Should we ship?",
    temperature: 0.7,
    maxTokens: 2048,
    response: "Absolutely, ship it!",
    durationMs: 42,
    ...over,
  };
}

describe("rawTranscript", () => {
  let dir: string;
  const saved: Record<string, string | undefined> = {};
  let counter = 0;

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    // Unique dir per test so the module's mkdir memoization can't collide.
    counter += 1;
    dir = join(tmpdir(), `council-raw-test-${process.pid}-${counter}`);
    process.env.COUNCIL_RAW_LOG_DIR = dir;
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe("isRawLogEnabled", () => {
    it("is disabled by default", () => {
      expect(isRawLogEnabled()).toBe(false);
    });

    it.each(["true", "1", "yes", "on", "TRUE", " On "])(
      "is enabled for %j",
      (val) => {
        process.env.COUNCIL_RAW_LOG = val;
        expect(isRawLogEnabled()).toBe(true);
      },
    );

    it.each(["false", "0", "no", "off", ""])("is disabled for %j", (val) => {
      process.env.COUNCIL_RAW_LOG = val;
      expect(isRawLogEnabled()).toBe(false);
    });
  });

  describe("logRawExchange", () => {
    it("writes nothing when disabled", () => {
      logRawExchange(makeEntry());
      expect(existsSync(dir)).toBe(false);
    });

    it("writes one JSONL record per call to a per-run file", () => {
      process.env.COUNCIL_RAW_LOG = "true";
      logRawExchange(makeEntry({ agentId: "a", response: "first" }));
      logRawExchange(makeEntry({ agentId: "b", response: "second" }));

      const file = join(dir, "council-test-1.jsonl");
      const lines = readFileSync(file, "utf8").trim().split("\n");
      expect(lines).toHaveLength(2);

      const first = JSON.parse(lines[0]);
      expect(first.agentId).toBe("a");
      expect(first.response).toBe("first");
      expect(first.systemPrompt).toBe("You are the Optimist.");
      expect(typeof first.timestamp).toBe("string");
      expect(JSON.parse(lines[1]).agentId).toBe("b");
    });

    it("does not truncate long prompts or responses", () => {
      process.env.COUNCIL_RAW_LOG = "true";
      const huge = "x".repeat(20_000);
      logRawExchange(makeEntry({ systemPrompt: huge, response: huge }));

      const file = join(dir, "council-test-1.jsonl");
      const rec = JSON.parse(readFileSync(file, "utf8").trim());
      expect(rec.systemPrompt).toHaveLength(20_000);
      expect(rec.response).toHaveLength(20_000);
    });

    it("records failed calls with the error and null response", () => {
      process.env.COUNCIL_RAW_LOG = "true";
      logRawExchange(
        makeEntry({ response: null, error: "boom", role: "judge" }),
      );
      const file = join(dir, "council-test-1.jsonl");
      const rec = JSON.parse(readFileSync(file, "utf8").trim());
      expect(rec.response).toBeNull();
      expect(rec.error).toBe("boom");
      expect(rec.role).toBe("judge");
    });

    it("separates runs into different files", () => {
      process.env.COUNCIL_RAW_LOG = "true";
      logRawExchange(makeEntry({ runId: "run-a" }));
      logRawExchange(makeEntry({ runId: "run-b" }));
      const files = readdirSync(dir).sort();
      expect(files).toEqual(["run-a.jsonl", "run-b.jsonl"]);
    });

    it("writes human-readable blocks in text format", () => {
      process.env.COUNCIL_RAW_LOG = "true";
      process.env.COUNCIL_RAW_LOG_FORMAT = "text";
      logRawExchange(makeEntry());
      const file = join(dir, "council-test-1.log");
      const content = readFileSync(file, "utf8");
      expect(content).toContain("SYSTEM PROMPT");
      expect(content).toContain("You are the Optimist.");
      expect(content).toContain("RESPONSE");
      expect(content).toContain("Absolutely, ship it!");
    });

    it("never throws when the write fails", () => {
      process.env.COUNCIL_RAW_LOG = "true";
      // Point the dir at a path that cannot be created (a file as parent).
      process.env.COUNCIL_RAW_LOG_DIR = join(__filename, "nope");
      expect(() => logRawExchange(makeEntry())).not.toThrow();
    });
  });

  describe("logRawEvent", () => {
    it("writes nothing when disabled", () => {
      logRawEvent("council-test-1", "run_started", { mode: "decision" });
      expect(existsSync(dir)).toBe(false);
    });

    it("appends events to the same per-run file as exchanges", () => {
      process.env.COUNCIL_RAW_LOG = "true";
      logRawEvent("council-test-1", "run_started", {
        mode: "decision",
        input: "Should we ship?",
      });
      logRawExchange(makeEntry());
      logRawEvent("council-test-1", "judge_request", {
        contributors: [{ order: 0, agentName: "Optimist" }],
        userMessage: "Response A: ...",
      });

      const file = join(dir, "council-test-1.jsonl");
      const lines = readFileSync(file, "utf8").trim().split("\n");
      expect(lines).toHaveLength(3);

      const started = JSON.parse(lines[0]);
      expect(started.kind).toBe("event");
      expect(started.event).toBe("run_started");
      expect(started.input).toBe("Should we ship?");

      expect(JSON.parse(lines[1]).kind).toBe("exchange");

      const judge = JSON.parse(lines[2]);
      expect(judge.event).toBe("judge_request");
      expect(judge.contributors[0].agentName).toBe("Optimist");
    });

    it("renders events as readable blocks in text format", () => {
      process.env.COUNCIL_RAW_LOG = "true";
      process.env.COUNCIL_RAW_LOG_FORMAT = "text";
      logRawEvent("council-test-1", "run_completed", { confidence: 4 });
      const content = readFileSync(join(dir, "council-test-1.log"), "utf8");
      expect(content).toContain("EVENT · run_completed");
      expect(content).toContain('"confidence": 4');
    });
  });
});
