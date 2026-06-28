import { describe, it, expect } from "vitest";
import {
  delay,
  generateId,
  randomPick,
  throwIfAborted,
  toAgentMeta,
} from "@/core/helpers";
import { CouncilAbortedError } from "@/core/errors";
import type { CouncilAgent } from "@/core/types";

describe("helpers", () => {
  it("generateId carries the prefix and is collision-resistant across calls", () => {
    const a = generateId("council");
    const b = generateId("council");
    expect(a.startsWith("council-")).toBe(true);
    expect(a).not.toBe(b);
  });

  it("randomPick returns the sole element of a single-item array", () => {
    expect(randomPick([42])).toBe(42);
  });

  it("randomPick only ever returns members of the array", () => {
    const items = ["a", "b", "c"];
    for (let i = 0; i < 50; i++) {
      expect(items).toContain(randomPick(items));
    }
  });

  it("throwIfAborted throws CouncilAbortedError when the signal has fired", () => {
    const ac = new AbortController();
    ac.abort();
    expect(() => throwIfAborted(ac.signal)).toThrow(CouncilAbortedError);
  });

  it("throwIfAborted is a no-op for an unfired or absent signal", () => {
    expect(() => throwIfAborted(new AbortController().signal)).not.toThrow();
    expect(() => throwIfAborted(undefined)).not.toThrow();
  });

  it("toAgentMeta projects only the public metadata fields", () => {
    const agent: CouncilAgent = {
      id: "a1",
      name: "Optimist",
      role: "weigh upside",
      systemPrompt: "secret prompt that must not leak",
    } as CouncilAgent;

    expect(toAgentMeta(agent)).toEqual({
      id: "a1",
      name: "Optimist",
      role: "weigh upside",
      isFinalJudge: false,
    });
  });

  it("toAgentMeta preserves an explicit isFinalJudge flag", () => {
    const judge = {
      id: "j",
      name: "Judge",
      role: "decide",
      systemPrompt: "p",
      isFinalJudge: true,
    } as CouncilAgent;
    expect(toAgentMeta(judge).isFinalJudge).toBe(true);
  });

  it("delay resolves (smoke)", async () => {
    await expect(delay(1)).resolves.toBeUndefined();
  });
});
