import { describe, it, expect } from "vitest";
import { aggregateModelStats } from "@/core/modelStats";
import type { AgentResponse } from "@/core/types";

const r = (model: string | undefined, confidence: number): AgentResponse => ({
  agentId: "a",
  agentName: "A",
  content: "",
  confidence,
  model,
});

describe("aggregateModelStats", () => {
  it("aggregates per model with avg confidence and distinct modes", () => {
    const stats = aggregateModelStats([
      { modeId: "decision", agentResponses: [r("gpt", 4), r("gpt", 2)] },
      { modeId: "swot", agentResponses: [r("gpt", 3), r("claude", 5)] },
    ]);

    const gpt = stats.find((s) => s.model === "gpt")!;
    expect(gpt.responseCount).toBe(3);
    expect(gpt.avgConfidence).toBe(3); // (4+2+3)/3
    expect(gpt.modes).toEqual(["decision", "swot"]);

    const claude = stats.find((s) => s.model === "claude")!;
    expect(claude.responseCount).toBe(1);
    expect(claude.avgConfidence).toBe(5);
  });

  it("buckets responses without a model under 'unknown' and sorts by count", () => {
    const stats = aggregateModelStats([
      { modeId: "idea", agentResponses: [r(undefined, 3), r("gpt", 4), r("gpt", 4)] },
    ]);
    expect(stats[0].model).toBe("gpt"); // most responses first
    expect(stats.map((s) => s.model)).toContain("unknown");
  });

  it("returns an empty array for no runs", () => {
    expect(aggregateModelStats([])).toEqual([]);
  });
});
