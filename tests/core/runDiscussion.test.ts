import { describe, it, expect } from "vitest";
import { runDiscussion, isDegenerateResponse } from "@/core/runDiscussion";
import { ValidationError, CouncilAbortedError } from "@/core/errors";
import type { DiscussionProgressEvent } from "@/core/types";

describe("runDiscussion", () => {
  // ─── Validation ──────────────────────────────────────────────────

  it("throws ValidationError for empty topic", async () => {
    await expect(
      runDiscussion({ topic: "   ", agentIds: ["optimist", "sceptic"], rounds: 1 }),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError for fewer than 2 agents", async () => {
    await expect(
      runDiscussion({ topic: "Hi", agentIds: ["optimist"], rounds: 1 }),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError for more than 4 agents", async () => {
    await expect(
      runDiscussion({
        topic: "Hi",
        agentIds: ["optimist", "sceptic", "pragmatist", "teacher", "beginner"],
        rounds: 1,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError for duplicate agents", async () => {
    await expect(
      runDiscussion({
        topic: "Hi",
        agentIds: ["optimist", "optimist"],
        rounds: 1,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError for unknown agent id", async () => {
    await expect(
      runDiscussion({
        topic: "Hi",
        agentIds: ["optimist", "does-not-exist"],
        rounds: 1,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError for rounds out of range", async () => {
    await expect(
      runDiscussion({ topic: "Hi", agentIds: ["optimist", "sceptic"], rounds: 0 }),
    ).rejects.toThrow(ValidationError);
    await expect(
      runDiscussion({ topic: "Hi", agentIds: ["optimist", "sceptic"], rounds: 99 }),
    ).rejects.toThrow(ValidationError);
  });

  // ─── Happy path ──────────────────────────────────────────────────

  it("produces agents × rounds turns in round-robin order", async () => {
    const result = await runDiscussion({
      topic: "Should we adopt a 4-day work week?",
      agentIds: ["optimist", "sceptic", "pragmatist"],
      rounds: 2,
    });

    expect(result.participants).toHaveLength(3);
    expect(result.rounds).toBe(2);
    // 3 agents × 2 rounds = 6 turns.
    expect(result.turns).toHaveLength(6);

    // Round-robin: each round cycles optimist → sceptic → pragmatist.
    const order = ["optimist", "sceptic", "pragmatist"];
    result.turns.forEach((turn, i) => {
      expect(turn.agentId).toBe(order[i % 3]);
      expect(turn.round).toBe(Math.floor(i / 3) + 1);
      expect(turn.index).toBe(i);
      expect(turn.ok).toBe(true);
      expect(turn.content.length).toBeGreaterThan(0);
    });
  });

  // ─── Summarizer ──────────────────────────────────────────────────

  it("omits the summary when no summarizer is selected", async () => {
    const result = await runDiscussion({
      topic: "Test topic",
      agentIds: ["optimist", "sceptic"],
      rounds: 1,
    });
    expect(result.summary).toBeUndefined();
  });

  it("produces a closing summary when a summarizer is selected", async () => {
    const result = await runDiscussion({
      topic: "Should we adopt a 4-day work week?",
      agentIds: ["optimist", "sceptic"],
      rounds: 1,
      summarizerId: "final-judge",
    });

    expect(result.summary).toBeDefined();
    expect(result.summary?.agentId).toBe("final-judge");
    expect(result.summary?.ok).toBe(true);
    expect(result.summary?.content.length).toBeGreaterThan(0);
    // The summary is not one of the discussion turns.
    expect(result.turns).toHaveLength(2);
  });

  it("emits summary progress events when a summarizer is selected", async () => {
    const events: DiscussionProgressEvent[] = [];
    await runDiscussion({
      topic: "Test topic",
      agentIds: ["optimist", "sceptic"],
      rounds: 1,
      summarizerId: "final-synthesizer",
      onProgress: (e) => events.push(e),
    });
    expect(events.filter((e) => e.type === "summary_started")).toHaveLength(1);
    expect(events.filter((e) => e.type === "summary_completed")).toHaveLength(1);
    // The summary runs after the last turn.
    const lastTurn = events.map((e) => e.type).lastIndexOf("turn_completed");
    const summaryStart = events.map((e) => e.type).indexOf("summary_started");
    expect(summaryStart).toBeGreaterThan(lastTurn);
  });

  it("rejects an unknown summarizer id", async () => {
    await expect(
      runDiscussion({
        topic: "Test",
        agentIds: ["optimist", "sceptic"],
        rounds: 1,
        summarizerId: "nope",
      }),
    ).rejects.toThrow(ValidationError);
  });

  // ─── Progress streaming ──────────────────────────────────────────

  it("emits discussion/round/turn progress events in order", async () => {
    const events: DiscussionProgressEvent[] = [];
    await runDiscussion({
      topic: "Test topic",
      agentIds: ["optimist", "sceptic"],
      rounds: 2,
      onProgress: (e) => events.push(e),
    });

    expect(events[0].type).toBe("discussion_started");
    expect(events.filter((e) => e.type === "round_started")).toHaveLength(2);
    expect(events.filter((e) => e.type === "turn_started")).toHaveLength(4);
    expect(events.filter((e) => e.type === "turn_completed")).toHaveLength(4);
  });

  // ─── Degenerate-reply detection ──────────────────────────────────

  it("flags non-substantive replies as degenerate", () => {
    expect(isDegenerateResponse("")).toBe(true);
    expect(isDegenerateResponse("   ")).toBe(true);
    expect(isDegenerateResponse("User Safety: safe")).toBe(true);
    expect(isDegenerateResponse("safety: safe")).toBe(true);
    expect(isDegenerateResponse("Moderation: none")).toBe(true);
    expect(isDegenerateResponse("ok")).toBe(true);
  });

  it("accepts a real conversational reply", () => {
    expect(
      isDegenerateResponse(
        "I disagree with the optimist — a 4-day week risks overloading the remaining days.",
      ),
    ).toBe(false);
  });

  // ─── Cancellation ────────────────────────────────────────────────

  it("aborts before any turn when the signal is already fired", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runDiscussion({
        topic: "Test",
        agentIds: ["optimist", "sceptic"],
        rounds: 2,
        signal: controller.signal,
      }),
    ).rejects.toThrow(CouncilAbortedError);
  });
});
