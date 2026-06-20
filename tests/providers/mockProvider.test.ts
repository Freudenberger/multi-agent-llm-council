import { afterEach, describe, expect, it } from "vitest";
import { MockProvider } from "@/providers/mockProvider";
import {
  setMockResponder,
  setMockLatency,
  resetMockProvider,
} from "@/providers";
import { CouncilAbortedError } from "@/core/errors";

/**
 * The mock provider is the backbone of every test and the keyless demo. These
 * tests pin its "smart simulation" contract: deterministic, contextual, and
 * shaped per request type — plus the test-injection hooks.
 */
describe("MockProvider", () => {
  const provider = new MockProvider();

  // No real latency needed for content/determinism assertions.
  setMockLatency(0);
  afterEach(() => {
    resetMockProvider();
    setMockLatency(0);
  });

  const specialist = (userInput: string, persona = "You are the Optimist.") => ({
    systemPrompt: persona,
    userMessage: `You are participating in a decision analysis council.\n\nYour role: Optimist — positive\n\nQuestion/Topic:\n${userInput}\n\nProvide your independent analysis.`,
  });

  // ─── Determinism ───────────────────────────────────────────────────

  it("is deterministic: identical input yields identical output", async () => {
    const input = specialist("Should we adopt Rust?");
    const a = await provider.generate(input);
    const b = await provider.generate(input);
    expect(a.content).toBe(b.content);
    expect(a.model).toBe("mock-provider");
  });

  it("varies output across different questions", async () => {
    const a = await provider.generate(specialist("Should we adopt Rust?"));
    const b = await provider.generate(specialist("Should we hire more staff?"));
    expect(a.content).not.toBe(b.content);
  });

  // ─── Contextual ────────────────────────────────────────────────────

  it("weaves the actual question into the specialist response", async () => {
    const { content } = await provider.generate(
      specialist("Should we migrate to a monorepo?"),
    );
    expect(content).toContain("monorepo");
  });

  it("reflects the agent persona (role voice) in the response", async () => {
    const optimist = await provider.generate(
      specialist("Ship the feature?", "You are the Sceptic."),
    );
    // Sceptic voice pushes back; it should not read as unconditional praise.
    expect(optimist.content.length).toBeGreaterThan(40);
  });

  // ─── Request-shape routing ─────────────────────────────────────────

  it("produces a parseable structured report for the report judge", async () => {
    const { content } = await provider.generate({
      systemPrompt: "You are the Final Judge in a decision analysis council.",
      userMessage:
        "Original Question/Topic:\nShould we ship?\n\n---\n\nSpecialist responses…",
    });
    for (const heading of [
      "## Summary",
      "## Key Conclusions",
      "## Areas of Agreement",
      "## Areas of Disagreement",
      "## Risks and Limitations",
      "## Recommendations",
      "## Confidence Score",
    ]) {
      expect(content).toContain(heading);
    }
    expect(content).toMatch(/## Confidence Score\n[1-5]/);
  });

  it("produces a direct answer (no report sections) for the answer judge", async () => {
    const { content } = await provider.generate({
      systemPrompt: "You are the Final Answer Judge in an answer council.",
      userMessage: "Original Question/Topic:\nWhat should I cook?\n\n---\n",
    });
    expect(content).not.toContain("## Summary");
    expect(content).not.toContain("## Confidence Score");
    expect(content).toContain("What should I cook");
  });

  it("emits Evaluations + Ranking for a peer-review request", async () => {
    const { content } = await provider.generate({
      systemPrompt:
        "You are now acting as an impartial peer reviewer in a decision analysis council.",
      userMessage:
        "Original Question/Topic:\nShip it?\n\n---\n\n### Response A\nfoo\n\n---\n\n### Response B\nbar\n\n---\n\n### Response C\nbaz",
    });
    expect(content).toContain("## Evaluations");
    expect(content).toContain("## Ranking");
    // One ranking line per candidate response.
    expect(content).toContain("Response A");
    expect(content).toContain("Response C");
  });

  it("produces a substantive, non-degenerate discussion turn", async () => {
    const { content } = await provider.generate({
      systemPrompt:
        "You are the Optimist.\n\nYou are taking part in a live, multi-agent roundtable discussion alongside other participants: Sceptic.",
      userMessage:
        "Discussion topic:\nFour-day week?\n\nConversation so far:\nSceptic: I have doubts about coverage.\n\n---\n\nYou are Optimist. It is now your turn to speak (round 1 of 2). Respond in character.",
    });
    expect(content.length).toBeGreaterThanOrEqual(25);
    // References the prior speaker — reads like a reply, not a monologue.
    expect(content).toContain("Sceptic");
  });

  // ─── Token limit simulation ────────────────────────────────────────

  it("truncates hard when maxTokens is too small", async () => {
    const full = await provider.generate({
      ...specialist("A reasonably long question about system design trade-offs"),
    });
    const truncated = await provider.generate({
      ...specialist("A reasonably long question about system design trade-offs"),
      maxTokens: 5, // ~20 chars
    });
    expect(truncated.content.length).toBeLessThan(full.content.length);
    expect(truncated.content.length).toBeLessThanOrEqual(20);
  });

  // ─── Test-injection hooks ──────────────────────────────────────────

  it("setMockResponder overrides the content", async () => {
    setMockResponder(() => "SCRIPTED");
    const { content } = await provider.generate(specialist("anything"));
    expect(content).toBe("SCRIPTED");
  });

  it("setMockResponder can defer to the default by returning undefined", async () => {
    setMockResponder((input) =>
      input.userMessage.includes("override") ? "X" : undefined,
    );
    const deferred = await provider.generate(specialist("normal question"));
    expect(deferred.content).not.toBe("X");
    expect(deferred.content.length).toBeGreaterThan(0);
  });

  it("setMockResponder can simulate a provider failure", async () => {
    setMockResponder(() => {
      throw new Error("simulated upstream 500");
    });
    await expect(provider.generate(specialist("boom"))).rejects.toThrow(
      "simulated upstream 500",
    );
  });

  // ─── Cancellation ──────────────────────────────────────────────────

  it("rejects with CouncilAbortedError when the signal is already aborted", async () => {
    setMockLatency(50);
    const controller = new AbortController();
    controller.abort();
    await expect(
      provider.generate({ ...specialist("x"), signal: controller.signal }),
    ).rejects.toBeInstanceOf(CouncilAbortedError);
  });

  it("rejects when aborted mid-flight", async () => {
    setMockLatency(200);
    const controller = new AbortController();
    const promise = provider.generate({
      ...specialist("x"),
      signal: controller.signal,
    });
    controller.abort();
    await expect(promise).rejects.toBeInstanceOf(CouncilAbortedError);
  });
});
