import { describe, it, expect } from "vitest";
import { runCouncil } from "@/core/runCouncil";
import { ModeNotFoundError, ValidationError } from "@/core/errors";

describe("runCouncil", () => {
  // ─── Validation ──────────────────────────────────────────────────

  it("should throw ValidationError for empty input", async () => {
    await expect(runCouncil({ input: "", mode: "decision" })).rejects.toThrow(
      ValidationError,
    );
  });

  it("should throw ValidationError for whitespace-only input", async () => {
    await expect(
      runCouncil({ input: "   ", mode: "decision" }),
    ).rejects.toThrow(ValidationError);
  });

  it("should throw ModeNotFoundError for invalid mode", async () => {
    await expect(
      runCouncil({ input: "test", mode: "invalid" as never }),
    ).rejects.toThrow(ModeNotFoundError);
  });

  // ─── Basic runs per mode ─────────────────────────────────────────

  it("should run decision council with mock provider", async () => {
    const result = await runCouncil({
      input: "Should we create a mobile app?",
      mode: "decision",
    });

    expect(result.id).toBeDefined();
    expect(result.modeId).toBe("decision");
    expect(result.userInput).toBe("Should we create a mobile app?");
    expect(result.agentResponses.length).toBeGreaterThan(0);
    expect(result.finalReport).toBeDefined();
    expect(result.finalReport.confidence).toBeGreaterThanOrEqual(1);
    expect(result.finalReport.confidence).toBeLessThanOrEqual(5);
    expect(result.createdAt).toBeDefined();
  }, 30000);

  it("should run idea council with mock provider", async () => {
    const result = await runCouncil({
      input: "An AI-powered learning assistant",
      mode: "idea",
    });

    expect(result.modeId).toBe("idea");
    expect(result.agentResponses.length).toBeGreaterThan(0);
    expect(result.finalReport.summary).toBeDefined();
  }, 30000);

  it("should run all 6 modes successfully", async () => {
    const modes = [
      "decision",
      "idea",
      "criticalReview",
      "learning",
      "technical",
      "answer",
    ] as const;

    for (const mode of modes) {
      const result = await runCouncil({
        input: `Test question for ${mode}`,
        mode,
      });
      expect(result.modeId).toBe(mode);
      expect(result.agentResponses.length).toBeGreaterThan(0);
      expect(result.finalReport).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
    }
  }, 60000);

  // ─── Result structure ────────────────────────────────────────────

  it("should include all expected report fields", async () => {
    const result = await runCouncil({
      input: "Test question",
      mode: "learning",
    });

    const report = result.finalReport;
    expect(report).toHaveProperty("summary");
    expect(report).toHaveProperty("keyConclusions");
    expect(report).toHaveProperty("agreements");
    expect(report).toHaveProperty("disagreements");
    expect(report).toHaveProperty("risks");
    expect(report).toHaveProperty("recommendations");
    expect(report).toHaveProperty("confidence");
  }, 30000);

  it("should return agent responses with required fields", async () => {
    const result = await runCouncil({
      input: "Test",
      mode: "decision",
    });

    for (const response of result.agentResponses) {
      expect(response.agentId).toBeDefined();
      expect(response.agentName).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.confidence).toBeGreaterThanOrEqual(1);
      expect(response.confidence).toBeLessThanOrEqual(5);
    }
  }, 30000);

  it("should return a valid ISO timestamp", async () => {
    const result = await runCouncil({
      input: "Test",
      mode: "decision",
    });

    const date = new Date(result.createdAt);
    expect(date.toISOString()).toBe(result.createdAt);
  }, 30000);

  it("should return a unique ID for each run", async () => {
    const [r1, r2] = await Promise.all([
      runCouncil({ input: "First", mode: "decision" }),
      runCouncil({ input: "Second", mode: "decision" }),
    ]);
    expect(r1.id).not.toBe(r2.id);
  }, 30000);

  // ─── Judge response ──────────────────────────────────────────────

  it("should include judgeResponse when a judge is configured", async () => {
    const result = await runCouncil({
      input: "Should we refactor the codebase?",
      mode: "technical",
    });

    expect(result.judgeResponse).not.toBeNull();
    expect(result.judgeResponse!.agentName).toBeDefined();
    expect(result.judgeResponse!.content.length).toBeGreaterThan(0);
  }, 30000);

  // ─── Custom agents ───────────────────────────────────────────────

  it("should accept custom agent overrides", async () => {
    const result = await runCouncil({
      input: "Test with custom agent",
      mode: "decision",
      customAgents: {
        optimist: {
          id: "optimist",
          name: "Custom Optimist",
          role: "Very positive",
          systemPrompt: "Always say yes",
        },
      },
    });

    expect(result.modeId).toBe("decision");
    const customAgent = result.agentResponses.find(
      (r) => r.agentName === "Custom Optimist",
    );
    expect(customAgent).toBeDefined();
  }, 30000);

  it("should filter out disabled agents", async () => {
    const result = await runCouncil({
      input: "Test with disabled agent",
      mode: "decision",
      customAgents: {
        optimist: {
          id: "optimist",
          name: "Optimist",
          role: "Positive",
          systemPrompt: "Be positive",
          disabled: true,
        },
      },
    });

    const optimistResponse = result.agentResponses.find(
      (r) => r.agentId === "optimist",
    );
    expect(optimistResponse).toBeUndefined();
  }, 30000);

  // ─── Report content ──────────────────────────────────────────────

  it("should produce a non-empty summary", async () => {
    const result = await runCouncil({
      input: "What are the benefits of TypeScript?",
      mode: "learning",
    });

    expect(result.finalReport.summary.length).toBeGreaterThan(10);
  }, 30000);

  it("should produce key conclusions as an array", async () => {
    const result = await runCouncil({
      input: "Evaluate microservices vs monolith",
      mode: "technical",
    });

    expect(Array.isArray(result.finalReport.keyConclusions)).toBe(true);
  }, 30000);

  it("should produce recommendations as an array", async () => {
    const result = await runCouncil({
      input: "Should we adopt a new framework?",
      mode: "decision",
    });

    expect(Array.isArray(result.finalReport.recommendations)).toBe(true);
  }, 30000);
});
