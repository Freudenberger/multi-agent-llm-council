/**
 * Small orchestration helpers shared by runCouncil.ts and runDiscussion.ts.
 * Extracted to keep the two engines in sync (was duplicated in both).
 */
import type { CouncilAgent, CouncilAgentMeta } from "./types";
import { CouncilAbortedError } from "./errors";

/** Resolves after `ms` milliseconds. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A short, collision-resistant id, e.g. `council-1700000000000-ab12cd`. */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/** Picks one element at random. Caller guarantees a non-empty array. */
export function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Throws CouncilAbortedError if the run's signal has fired. */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new CouncilAbortedError();
}

/** Projects a full agent down to the metadata exposed in progress events. */
export function toAgentMeta(agent: CouncilAgent): CouncilAgentMeta {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    isFinalJudge: agent.isFinalJudge ?? false,
  };
}
