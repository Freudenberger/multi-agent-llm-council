import type { AgentResponse } from "./types";

/** One row of the model comparison dashboard. */
export interface ModelStat {
  model: string;
  /** Number of agent responses produced by this model. */
  responseCount: number;
  /** Mean self-reported confidence (1–5) across those responses, rounded to 1dp. */
  avgConfidence: number;
  /** Distinct council modes the model was used in. */
  modes: string[];
}

type RunLike = { modeId: string; agentResponses: AgentResponse[] };

/**
 * Aggregate a user's saved council runs into per-model comparison rows.
 * Pure (no storage/IO) so it's trivially testable. Responses with no recorded
 * model (older conversations) are bucketed under "unknown".
 */
export function aggregateModelStats(runs: RunLike[]): ModelStat[] {
  const acc = new Map<
    string,
    { sum: number; count: number; modes: Set<string> }
  >();

  for (const run of runs) {
    for (const r of run.agentResponses) {
      const model = r.model ?? "unknown";
      const cur = acc.get(model) ?? { sum: 0, count: 0, modes: new Set() };
      cur.sum += r.confidence;
      cur.count += 1;
      cur.modes.add(run.modeId);
      acc.set(model, cur);
    }
  }

  return [...acc.entries()]
    .map(([model, { sum, count, modes }]) => ({
      model,
      responseCount: count,
      avgConfidence: Math.round((sum / count) * 10) / 10,
      modes: [...modes].sort(),
    }))
    .sort((a, b) => b.responseCount - a.responseCount);
}
