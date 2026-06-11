import { describe, it, expect } from "vitest";
import {
  buildAgentUserMessage,
  buildJudgeSystemPrompt,
  buildJudgeUserMessage,
} from "@/prompts/buildPrompts";
import type { CouncilAgent, CouncilModeId } from "@/core/types";

describe("buildPrompts", () => {
  const sampleAgent: CouncilAgent = {
    id: "test-agent",
    name: "Test Agent",
    role: "Tests things",
    systemPrompt: "You are a test agent.",
  };

  describe("buildAgentUserMessage", () => {
    it("should include the agent name", () => {
      const msg = buildAgentUserMessage("decision", "test input", sampleAgent);
      expect(msg).toContain("Test Agent");
    });

    it("should include the agent role", () => {
      const msg = buildAgentUserMessage("decision", "test input", sampleAgent);
      expect(msg).toContain("Tests things");
    });

    it("should include the user input", () => {
      const msg = buildAgentUserMessage(
        "decision",
        "Should we build this?",
        sampleAgent,
      );
      expect(msg).toContain("Should we build this?");
    });

    it("should include the mode description", () => {
      const msg = buildAgentUserMessage("decision", "test", sampleAgent);
      expect(msg).toContain("decision analysis council");
    });

    it("should include different mode descriptions", () => {
      const modes = [
        "decision",
        "idea",
        "criticalReview",
        "learning",
        "technical",
        "answer",
      ] as const;
      const expectedSnippets: Record<string, string> = {
        decision: "decision analysis council",
        idea: "idea evaluation council",
        criticalReview: "critical review council",
        learning: "learning council",
        technical: "technical analysis council",
        answer: "answer council",
      };

      for (const mode of modes) {
        const msg = buildAgentUserMessage(mode, "test", sampleAgent);
        expect(msg).toContain(expectedSnippets[mode]);
      }
    });

    it("should instruct agent to provide independent analysis", () => {
      const msg = buildAgentUserMessage("decision", "test", sampleAgent);
      expect(msg).toContain("independent analysis");
      expect(msg).toContain("Do not reference other agents' responses");
    });

    it("should handle unknown mode gracefully", () => {
      const msg = buildAgentUserMessage(
        "unknown" as unknown as CouncilModeId,
        "test",
        sampleAgent,
      );
      expect(msg).toContain("multi-perspective analysis council");
    });
  });

  describe("buildJudgeSystemPrompt", () => {
    it("should return report-style prompt for standard modes", () => {
      const prompt = buildJudgeSystemPrompt("decision", "Decision Council");
      expect(prompt).toContain("Final Judge");
      expect(prompt).toContain("Decision Council");
      expect(prompt).toContain("COMPARE all specialist responses");
      expect(prompt).toContain("## Summary");
      expect(prompt).toContain("## Key Conclusions");
      expect(prompt).toContain("## Areas of Agreement");
      expect(prompt).toContain("## Areas of Disagreement");
      expect(prompt).toContain("## Risks and Limitations");
      expect(prompt).toContain("## Recommendations");
      expect(prompt).toContain("## Confidence Score");
    });

    it("should return answer-style prompt for answer mode", () => {
      const prompt = buildJudgeSystemPrompt("answer", "Answer Council");
      expect(prompt).toContain("Final Answer Judge");
      expect(prompt).toContain("Answer Council");
      expect(prompt).toContain("Answer the user's original question directly");
      expect(prompt).toContain("Do NOT produce a Council Analysis Report");
      expect(prompt).toContain("Do NOT mention the council");
    });

    it("should include mode name in the prompt", () => {
      const prompt = buildJudgeSystemPrompt("learning", "Learning Council");
      expect(prompt).toContain("Learning Council");
    });

    it("should handle all standard modes", () => {
      const modes = [
        "decision",
        "idea",
        "criticalReview",
        "learning",
        "technical",
      ] as const;
      for (const mode of modes) {
        const prompt = buildJudgeSystemPrompt(mode, `${mode} Council`);
        expect(prompt.length).toBeGreaterThan(100);
        expect(prompt).toContain("Final Judge");
      }
    });
  });

  describe("buildJudgeUserMessage", () => {
    it("should include the original question", () => {
      const msg = buildJudgeUserMessage("decision", "my question", []);
      expect(msg).toContain("my question");
    });

    it("should include all agent responses", () => {
      const responses = [
        { agentName: "Agent A", role: "Role A", content: "Response A" },
        { agentName: "Agent B", role: "Role B", content: "Response B" },
      ];
      const msg = buildJudgeUserMessage("decision", "question", responses);
      expect(msg).toContain("Agent A");
      expect(msg).toContain("Role A");
      expect(msg).toContain("Response A");
      expect(msg).toContain("Agent B");
      expect(msg).toContain("Role B");
      expect(msg).toContain("Response B");
    });

    it("should handle empty responses array", () => {
      const msg = buildJudgeUserMessage("decision", "question", []);
      expect(msg).toContain("question");
      expect(msg).toContain("Specialist Agent Responses");
    });

    it("should separate responses with dividers", () => {
      const responses = [
        { agentName: "A", role: "R", content: "C1" },
        { agentName: "B", role: "R", content: "C2" },
      ];
      const msg = buildJudgeUserMessage("decision", "q", responses);
      expect(msg).toContain("---");
    });

    it("should instruct judge to produce final report", () => {
      const msg = buildJudgeUserMessage("decision", "q", []);
      expect(msg).toContain("evaluate all specialist responses");
      expect(msg).toContain("final structured report");
    });
  });
});
