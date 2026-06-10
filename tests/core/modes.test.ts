import { describe, it, expect } from "vitest";
import { councilModes, getMode, listModes } from "@/modes";
import { getSpecialists, getFinalJudge } from "@/core/types";
import type { CouncilModeId } from "@/core/types";

describe("modes", () => {
  describe("councilModes registry", () => {
    it("should contain all 7 modes", () => {
      const modeIds = Object.keys(councilModes) as CouncilModeId[];
      expect(modeIds).toHaveLength(7);
      expect(modeIds).toContain("decision");
      expect(modeIds).toContain("idea");
      expect(modeIds).toContain("criticalReview");
      expect(modeIds).toContain("learning");
      expect(modeIds).toContain("technical");
      expect(modeIds).toContain("answer");
      expect(modeIds).toContain("swot");
    });

    it("should have required fields for each mode", () => {
      for (const mode of Object.values(councilModes)) {
        expect(mode.id).toBeDefined();
        expect(mode.name).toBeDefined();
        expect(mode.description).toBeDefined();
        expect(mode.agents.length).toBeGreaterThanOrEqual(4);
      }
    });

    it("should have exactly one final judge per mode", () => {
      for (const mode of Object.values(councilModes)) {
        const judges = mode.agents.filter((a) => a.isFinalJudge);
        expect(judges).toHaveLength(1);
      }
    });

    it("should have at least 2 specialists per mode", () => {
      for (const mode of Object.values(councilModes)) {
        const specialists = getSpecialists(mode);
        expect(specialists.length).toBeGreaterThanOrEqual(2);
      }
    });

    it("should have unique agent IDs within each mode", () => {
      for (const mode of Object.values(councilModes)) {
        const ids = mode.agents.map((a) => a.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
      }
    });

    it("should have agents with name, role, and systemPrompt", () => {
      for (const mode of Object.values(councilModes)) {
        for (const agent of mode.agents) {
          expect(agent.name.length).toBeGreaterThan(0);
          expect(agent.role.length).toBeGreaterThan(0);
          expect(agent.systemPrompt.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("getMode", () => {
    it("should return a valid mode for each known ID", () => {
      const ids: CouncilModeId[] = [
        "decision",
        "idea",
        "criticalReview",
        "learning",
        "technical",
        "answer",
        "swot",
      ];
      for (const id of ids) {
        const mode = getMode(id);
        expect(mode.id).toBe(id);
      }
    });

    it("should throw for an unknown mode ID", () => {
      expect(() => getMode("nonexistent" as CouncilModeId)).toThrow(
        'Council mode "nonexistent" not found',
      );
    });
  });

  describe("listModes", () => {
    it("should return all 7 modes", () => {
      expect(listModes()).toHaveLength(7);
    });

    it("should return modes with the same IDs as the registry", () => {
      const ids = listModes().map((m) => m.id).sort();
      const registryIds = Object.keys(councilModes).sort();
      expect(ids).toEqual(registryIds);
    });
  });

  describe("getSpecialists / getFinalJudge helpers", () => {
    it("should separate specialists from judge correctly", () => {
      const mode = getMode("decision");
      const specialists = getSpecialists(mode);
      const judge = getFinalJudge(mode);

      expect(judge).toBeDefined();
      expect(judge!.isFinalJudge).toBe(true);
      for (const s of specialists) {
        expect(s.isFinalJudge).toBeFalsy();
      }
      expect(specialists.length + 1).toBe(mode.agents.length);
    });
  });

  describe("specific mode structures", () => {
    it("decision mode should have expected agents", () => {
      const mode = getMode("decision");
      const names = mode.agents.map((a) => a.name);
      expect(names).toContain("Optimist");
      expect(names).toContain("Sceptic");
      expect(names).toContain("Risk Analyst");
      expect(names).toContain("Pragmatist");
      expect(names).toContain("Final Judge");
    });

    it("learning mode should have expected agents", () => {
      const mode = getMode("learning");
      const names = mode.agents.map((a) => a.name);
      expect(names).toContain("Teacher");
      expect(names).toContain("Beginner");
      expect(names).toContain("Examiner");
      expect(names).toContain("Example Generator");
      expect(names).toContain("Final Explainer");
    });

    it("answer mode should have expected agents", () => {
      const mode = getMode("answer");
      const names = mode.agents.map((a) => a.name);
      expect(names).toContain("Subject Matter Expert");
      expect(names).toContain("Contrarian");
      expect(names).toContain("Contextualizer");
      expect(names).toContain("Synthesizer");
      expect(names).toContain("Final Summarizer");
    });

    it("swot mode should have the four quadrants plus a strategist judge", () => {
      const mode = getMode("swot");
      const names = mode.agents.map((a) => a.name);
      expect(names).toContain("Strengths Analyst");
      expect(names).toContain("Weaknesses Analyst");
      expect(names).toContain("Opportunities Analyst");
      expect(names).toContain("Threats Analyst");
      expect(names).toContain("SWOT Strategist");

      const judge = getFinalJudge(mode);
      expect(judge!.name).toBe("SWOT Strategist");
      expect(getSpecialists(mode)).toHaveLength(4);
    });
  });
});
