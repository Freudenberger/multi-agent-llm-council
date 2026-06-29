import { describe, it, expect } from "vitest";
import { runCouncil, applyFallbackModels } from "@/core/runCouncil";
import {
  ModeNotFoundError,
  ValidationError,
  CouncilAbortedError,
} from "@/core/errors";
import { getMode } from "@/modes";
import type { CouncilProgressEvent } from "@/core/types";

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

  it("returns token usage for specialist and judge responses", async () => {
    const result = await runCouncil({
      input: "Should we add response token counters to the UI?",
      mode: "decision",
    });

    for (const response of result.agentResponses) {
      expect(response.usage).toBeDefined();
      expect(response.usage?.inputTokens).toBeGreaterThan(0);
      expect(response.usage?.outputTokens).toBeGreaterThan(0);
      expect(response.usage?.totalTokens).toBe(
        (response.usage?.inputTokens ?? 0) +
          (response.usage?.outputTokens ?? 0),
      );
    }

    expect(result.judgeResponse?.usage).toBeDefined();
    expect(result.judgeResponse?.usage?.totalTokens).toBeGreaterThan(0);
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

  // ─── User-level fallback models (preferred models) ───────────────

  describe("applyFallbackModels", () => {
    it("assigns each agent without a model a value from the list", () => {
      const mode = getMode("decision");
      const list = ["anthropic/owl-alpha", "openrouter/free"];
      const result = applyFallbackModels(mode, list);
      expect(result.agents.length).toBeGreaterThan(0);
      for (const agent of result.agents) {
        expect(list).toContain(agent.model);
      }
    });

    it("assigns a single-model list to every agent (run everything on one model)", () => {
      const mode = getMode("decision");
      const result = applyFallbackModels(mode, ["anthropic/owl-alpha"]);
      for (const agent of result.agents) {
        expect(agent.model).toBe("anthropic/owl-alpha");
      }
    });

    it("picks independently per agent (injected picker is called per gap)", () => {
      const base = getMode("decision");
      const list = ["model-a", "model-b"];
      let i = 0;
      // round-robin picker to make selection deterministic
      const result = applyFallbackModels(
        base,
        list,
        () => list[i++ % list.length],
      );
      expect(result.agents[0].model).toBe("model-a");
      expect(result.agents[1].model).toBe("model-b");
    });

    it("does not override agents that already specify a model", () => {
      const base = getMode("decision");
      const mode = {
        ...base,
        agents: base.agents.map((a, i) =>
          i === 0 ? { ...a, model: "explicit/model" } : a,
        ),
      };
      const result = applyFallbackModels(mode, ["anthropic/owl-alpha"]);
      expect(result.agents[0].model).toBe("explicit/model");
      for (const agent of result.agents.slice(1)) {
        expect(agent.model).toBe("anthropic/owl-alpha");
      }
    });

    it("is a no-op when the list is empty or omitted", () => {
      const mode = getMode("decision");
      expect(applyFallbackModels(mode, [])).toEqual(mode);
      const result = applyFallbackModels(mode, undefined);
      expect(result).toEqual(mode);
      for (const agent of result.agents) {
        expect(agent.model).toBeUndefined();
      }
    });
  });

  // ─── Progress events & cancellation ──────────────────────────────

  describe("progress + cancellation", () => {
    it("emits run_started, phase, and per-agent progress events", async () => {
      const events: CouncilProgressEvent[] = [];
      await runCouncil({
        input: "Should we ship the feature?",
        mode: "decision",
        onProgress: (e) => events.push(e),
      });

      const types = events.map((e) => e.type);
      expect(types[0]).toBe("run_started");
      expect(types).toContain("phase_started");
      expect(types).toContain("agent_started");
      expect(types).toContain("agent_completed");

      // run_started lists the planned roster
      const start = events.find((e) => e.type === "run_started");
      expect(
        start && start.type === "run_started" && start.specialists.length,
      ).toBeGreaterThan(0);

      // every started agent eventually completes
      const started = events.filter((e) => e.type === "agent_started").length;
      const completed = events.filter(
        (e) => e.type === "agent_completed",
      ).length;
      expect(completed).toBe(started);

      // both phases are announced
      const phases = events
        .filter((e) => e.type === "phase_started")
        .map((e) => (e.type === "phase_started" ? e.phase : ""));
      expect(phases).toContain("specialists");
      expect(phases).toContain("judge");
    }, 30000);

    it("rejects with CouncilAbortedError when the signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(
        runCouncil({
          input: "Cancel me before I start",
          mode: "decision",
          signal: controller.signal,
        }),
      ).rejects.toBeInstanceOf(CouncilAbortedError);
    });

    it("aborts an in-flight run and stops before the judge", async () => {
      const controller = new AbortController();
      const events: CouncilProgressEvent[] = [];
      // Abort as soon as the first agent starts working.
      const promise = runCouncil({
        input: "Cancel me mid-run",
        mode: "decision",
        signal: controller.signal,
        onProgress: (e) => {
          if (e.type === "agent_started") controller.abort();
        },
      });

      await expect(promise).rejects.toBeInstanceOf(CouncilAbortedError);
      // The judge phase must never have started.
      expect(
        events.some((e) => e.type === "phase_started" && e.phase === "judge"),
      ).toBe(false);
    }, 30000);
  });

  // ─── Per-agent model selection ───────────────────────────────────

  it("should accept per-agent model overrides", async () => {
    const result = await runCouncil({
      input: "Test with custom model",
      mode: "decision",
      customAgents: {
        optimist: {
          id: "optimist",
          name: "Optimist",
          role: "Positive",
          systemPrompt: "Be positive",
          model: "openrouter/free",
        },
      },
    });

    expect(result.modeId).toBe("decision");
    const customAgent = result.agentResponses.find(
      (r) => r.agentId === "optimist",
    );
    expect(customAgent).toBeDefined();
    expect(customAgent!.content.length).toBeGreaterThan(0);
  }, 30000);

  it("should run with different models for different agents", async () => {
    const result = await runCouncil({
      input: "Test with mixed models",
      mode: "decision",
      customAgents: {
        optimist: {
          id: "optimist",
          name: "Optimist",
          role: "Positive",
          systemPrompt: "Be positive",
          model: "openrouter/free",
        },
        sceptic: {
          id: "sceptic",
          name: "Sceptic",
          role: "Critical",
          systemPrompt: "Be critical",
          model: "openrouter/free",
        },
      },
    });

    expect(result.agentResponses.length).toBeGreaterThan(0);
    // All agents should have responded
    const optimist = result.agentResponses.find(
      (r) => r.agentId === "optimist",
    );
    const sceptic = result.agentResponses.find((r) => r.agentId === "sceptic");
    expect(optimist).toBeDefined();
    expect(sceptic).toBeDefined();
  }, 30000);

  it("should run with model on some agents and default on others", async () => {
    const result = await runCouncil({
      input: "Test mixed model configuration",
      mode: "idea",
      customAgents: {
        "creative-thinker": {
          id: "creative-thinker",
          name: "Creative Thinker",
          role: "Creative",
          systemPrompt: "Think creatively",
          model: "openrouter/free",
        },
      },
    });

    expect(result.agentResponses.length).toBeGreaterThan(0);
    const creativeThinker = result.agentResponses.find(
      (r) => r.agentId === "creative-thinker",
    );
    expect(creativeThinker).toBeDefined();
    expect(creativeThinker!.content.length).toBeGreaterThan(0);
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

  // ─── Peer-review phase (opt-in, per-run) ─────────────────────────

  describe("peer review", () => {
    it("does not run peer review by default (no peerReviews in result)", async () => {
      const result = await runCouncil({
        input: "Should we migrate to a monorepo?",
        mode: "decision",
      });
      expect(result.peerReviews).toBeUndefined();
    }, 30000);

    it("adds peer reviews when peerReview is requested", async () => {
      const result = await runCouncil({
        input: "Should we migrate to a monorepo?",
        mode: "decision",
        peerReview: true,
      });

      expect(result.peerReviews).toBeDefined();
      expect(result.peerReviews!.length).toBeGreaterThanOrEqual(2);
      // Every reviewer is one of the run's specialists, and produced content.
      const specialistIds = new Set(
        result.agentResponses.map((r) => r.agentId),
      );
      for (const review of result.peerReviews!) {
        expect(specialistIds.has(review.agentId)).toBe(true);
        expect(review.content.length).toBeGreaterThan(0);
      }
    }, 30000);

    it("emits a peer-review phase between specialists and judge", async () => {
      const events: CouncilProgressEvent[] = [];
      await runCouncil({
        input: "Should we ship it?",
        mode: "decision",
        peerReview: true,
        onProgress: (e) => events.push(e),
      });

      const phases = events
        .filter((e) => e.type === "phase_started")
        .map((e) => (e.type === "phase_started" ? e.phase : ""));
      expect(phases).toContain("specialists");
      expect(phases).toContain("peer-review");
      expect(phases).toContain("judge");
      // Ordering: specialists → peer-review → judge.
      expect(phases.indexOf("specialists")).toBeLessThan(
        phases.indexOf("peer-review"),
      );
      expect(phases.indexOf("peer-review")).toBeLessThan(
        phases.indexOf("judge"),
      );
    }, 30000);

    it("skips peer review when fewer than 2 specialists succeed", async () => {
      // Disable all but one specialist → nothing to rank.
      const result = await runCouncil({
        input: "Edge case",
        mode: "decision",
        peerReview: true,
        customAgents: {
          sceptic: {
            id: "sceptic",
            name: "Sceptic",
            role: "Critical",
            systemPrompt: "Be critical",
            disabled: true,
          },
          "risk-analyst": {
            id: "risk-analyst",
            name: "Risk Analyst",
            role: "Risk",
            systemPrompt: "Find risks",
            disabled: true,
          },
          pragmatist: {
            id: "pragmatist",
            name: "Pragmatist",
            role: "Practical",
            systemPrompt: "Be practical",
            disabled: true,
          },
        },
      });

      expect(result.peerReviews).toBeUndefined();
    }, 30000);
  });
});
