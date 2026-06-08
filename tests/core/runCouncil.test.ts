import { describe, it, expect } from "vitest";
import { runCouncil } from "@/core/runCouncil";
import { ModeNotFoundError, ValidationError } from "@/core/errors";

describe("runCouncil", () => {
  it("should throw ValidationError for empty input", async () => {
    await expect(runCouncil({ input: "", mode: "decision" })).rejects.toThrow(
      ValidationError,
    );
  });

  it("should throw ModeNotFoundError for invalid mode", async () => {
    await expect(
      runCouncil({ input: "test", mode: "invalid" as never }),
    ).rejects.toThrow(ModeNotFoundError);
  });

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
});
