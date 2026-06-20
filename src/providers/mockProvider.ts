import type { LLMProvider, GenerateInput, GenerateOutput } from "./types";
import { logger } from "../core/logger";
import { CouncilAbortedError } from "../core/errors";

/**
 * Mock Provider — simulates an LLM without calling any external API.
 *
 * Unlike a fixed lookup table, this provider *reads* the request the way a real
 * model would: it detects which kind of call it is (specialist / peer review /
 * report judge / answer judge / discussion turn / discussion summary / code
 * review), extracts the actual question or topic from the user message, and
 * composes a contextual, role-flavoured reply that weaves the input back in.
 *
 * It is **deterministic**: the same (systemPrompt, userMessage) always yields
 * the same text and the same simulated latency (seeded PRNG, never
 * `Math.random`). Different inputs diverge. This makes it safe for snapshot
 * tests while still varying output across questions and roles, so tests that
 * assert "the response mentions the topic" or "two different prompts produce
 * different answers" hold.
 *
 * For tests that need full control (forced failures, truncation, latency,
 * scripted content) see `setMockResponder` / `setMockLatency` below.
 *
 * Used whenever `LLM_PROVIDER=mock` — the demo, the keyless reviewer, the CLI,
 * and the entire test suite.
 */

// ─── Test injection hooks ───────────────────────────────────────────
//
// These let a test bend the mock without monkey-patching. They are process
// globals, so always reset them in an `afterEach` to avoid cross-test leakage.

/**
 * A responder may return a string (used as the content), a full GenerateOutput,
 * `undefined` (fall through to the default smart behaviour), or throw / return a
 * rejected promise (simulate a provider error — e.g. to exercise retry/fallback
 * paths). It receives the same input the real `generate` would.
 */
export type MockResponder = (
  input: GenerateInput,
) =>
  | string
  | GenerateOutput
  | undefined
  | Promise<string | GenerateOutput | undefined>;

let customResponder: MockResponder | null = null;
let latencyOverrideMs: number | null = null;

/**
 * Install a responder that intercepts every `MockProvider.generate` call.
 * Return `undefined` from it to defer to the default contextual simulator for
 * that specific call. Pass `null` to remove it.
 */
export function setMockResponder(responder: MockResponder | null): void {
  customResponder = responder;
}

/** Convenience: clear the responder and any latency override. Call in afterEach. */
export function resetMockProvider(): void {
  customResponder = null;
  latencyOverrideMs = null;
}

/**
 * Force the simulated network latency (ms) for every call. `0` makes the mock
 * resolve on the next tick — handy for fast tests that don't exercise timing.
 * Pass `null` to restore the default seeded latency (~30–220ms).
 */
export function setMockLatency(ms: number | null): void {
  latencyOverrideMs = ms;
}

// ─── Seeded PRNG (deterministic, no Math.random) ────────────────────

/** xmur3 string hash → 32-bit seed. */
function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 PRNG — returns a generator of floats in [0, 1). */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

// ─── Input parsing helpers ──────────────────────────────────────────

/**
 * Pulls the actual question/topic out of a built user message so the mock can
 * echo it back the way a real model would. Falls back to the first meaningful
 * line. Kept short so it reads naturally when inlined into a sentence.
 */
function extractTopic(userMessage: string): string {
  const patterns = [
    /(?:Original\s+)?Question\/Topic:\s*\n([\s\S]*?)\n\s*\n/i,
    /Discussion topic:\s*\n([\s\S]*?)\n\s*\n/i,
  ];
  for (const re of patterns) {
    const m = userMessage.match(re);
    if (m && m[1].trim()) return clip(m[1].trim(), 160);
  }
  const firstLine = userMessage
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return clip(firstLine ?? "the topic", 160);
}

/** Truncate to a length, trimming on a word boundary and adding an ellipsis. */
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/** Anonymized response labels present in a peer-review user message. */
function extractResponseLabels(userMessage: string): string[] {
  const labels = [...userMessage.matchAll(/###\s*(Response [A-Z])/g)].map(
    (m) => m[1],
  );
  return labels.length > 0 ? labels : ["Response A", "Response B"];
}

/** The speaker whose turn it is, and the previous speaker, in a discussion. */
function extractDiscussionContext(userMessage: string): {
  speaker: string;
  lastSpeaker: string | null;
} {
  const speaker =
    userMessage.match(/You are ([^.]+?)\. It is now your turn/)?.[1]?.trim() ??
    "the next participant";
  // Last attributed line in the "Conversation so far" block, "Name: text".
  const convo = userMessage.match(
    /Conversation so far:\s*\n([\s\S]*?)\n\s*---/,
  )?.[1];
  let lastSpeaker: string | null = null;
  if (convo && !/Nobody has spoken yet/i.test(convo)) {
    const lines = convo.split("\n").filter((l) => l.includes(":"));
    const last = lines[lines.length - 1];
    lastSpeaker = last?.split(":")[0]?.trim() ?? null;
  }
  return { speaker, lastSpeaker };
}

// ─── Role voices ────────────────────────────────────────────────────
//
// Each specialist role gets a short stance + a lens it views the topic through.
// The composer wraps these around the real topic so the reply is contextual and
// recognisably "in character" without being a frozen paragraph.

type Voice = { stance: string; lens: string; closer: string };

const ROLE_VOICES: Record<string, Voice> = {
  optimist: {
    stance: "I see a strong upside here",
    lens: "the opportunity and the best-case payoff",
    closer: "With focused execution the benefits clearly outweigh the downsides.",
  },
  sceptic: {
    stance: "I'm not convinced yet",
    lens: "the unexamined assumptions and failure modes",
    closer: "I'd want concrete evidence and a fallback plan before committing.",
  },
  "risk analyst": {
    stance: "Several risks stand out",
    lens: "resource, timeline, technical-debt and market exposure",
    closer: "Each needs a named owner and a documented mitigation path.",
  },
  pragmatist: {
    stance: "Let's anchor on what's actually achievable",
    lens: "effort versus impact under current constraints",
    closer: "Start with the highest-leverage, lowest-cost step and validate early.",
  },
  "creative thinker": {
    stance: "There's room to reframe this",
    lens: "unconventional angles and adjacent possibilities",
    closer: "A small twist on the framing could open up a much larger solution space.",
  },
  "market analyst": {
    stance: "The market signal is mixed but real",
    lens: "demand, competition and timing",
    closer: "A clear differentiator and a tight go-to-market window are decisive.",
  },
  "technical feasibility reviewer": {
    stance: "It's buildable, with caveats",
    lens: "scalability, integration and performance under load",
    closer: "I'd de-risk the core with a proof-of-concept before scaling.",
  },
  "user perspective": {
    stance: "From the user's seat this matters",
    lens: "the real pain point and the everyday experience",
    closer: "The value has to be obvious immediately or users won't stay.",
  },
  "logic reviewer": {
    stance: "The reasoning mostly holds",
    lens: "the inferential chain and where it leaps",
    closer: "A couple of links between premise and conclusion need to be made explicit.",
  },
  "clarity reviewer": {
    stance: "The intent comes through, but unevenly",
    lens: "structure, plain language and concrete examples",
    closer: "Simplifying the dense passages would lift comprehension noticeably.",
  },
  "evidence reviewer": {
    stance: "The support is partial",
    lens: "the strength and freshness of the evidence",
    closer: "More data points and recent sources would make the case far stronger.",
  },
  teacher: {
    stance: "Let me build this up step by step",
    lens: "the underlying mechanics and how the pieces fit",
    closer: "Think of it as building blocks that combine into something larger.",
  },
  beginner: {
    stance: "I'm still finding my footing here",
    lens: "what the jargon actually means in plain terms",
    closer: "A concrete everyday analogy would help this click for me.",
  },
  examiner: {
    stance: "Let me probe the understanding",
    lens: "the principles, applications and common misconceptions",
    closer: "Answering these would show whether the grasp is real or surface-level.",
  },
  "example generator": {
    stance: "Concrete cases make this land",
    lens: "small, mid-size and edge scenarios",
    closer: "Walking through one example per scale shows the trade-offs clearly.",
  },
  "software architect": {
    stance: "Structurally this is sound",
    lens: "separation of concerns, data flow and failure isolation",
    closer: "Tighter interface definitions and a versioning strategy would round it out.",
  },
  "security reviewer": {
    stance: "Security needs a closer look",
    lens: "input validation, auth flows, encryption and audit logging",
    closer: "Bringing security in earlier in the design is the highest-value change.",
  },
  "performance reviewer": {
    stance: "Performance is workable",
    lens: "caching, query cost and rate limiting under load",
    closer: "Load-test the hot paths before this reaches production.",
  },
  "maintainability reviewer": {
    stance: "Maintainability looks healthy",
    lens: "naming, modularity, docs and test coverage",
    closer: "Locking in coding standards now pays off as the team grows.",
  },
};

const GENERIC_VOICE: Voice = {
  stance: "Here's my read",
  lens: "the core trade-offs",
  closer: "On balance, the path forward depends on which constraints bind hardest.",
};

/** Match the agent persona (system prompt) to a known role voice. */
function detectVoice(systemPromptLower: string): { key: string; voice: Voice } {
  for (const [key, voice] of Object.entries(ROLE_VOICES)) {
    if (systemPromptLower.includes(key)) return { key, voice };
  }
  return { key: "analyst", voice: GENERIC_VOICE };
}

// ─── Content composers (one per request shape) ──────────────────────

function composeSpecialist(
  voice: Voice,
  topic: string,
  rng: () => number,
): string {
  const openers = [
    `Looking at "${topic}", ${voice.stance.toLowerCase()}.`,
    `On "${topic}": ${voice.stance}.`,
    `My take on "${topic}" — ${voice.stance.toLowerCase()}.`,
  ];
  const middles = [
    `I'm weighing this through ${voice.lens}.`,
    `What I focus on is ${voice.lens}.`,
    `The lens I bring is ${voice.lens}.`,
  ];
  return [
    pick(rng, openers),
    pick(rng, middles),
    voice.closer,
  ].join(" ");
}

function composeReportJudge(topic: string, rng: () => number): string {
  const confidence = 3 + Math.floor(rng() * 3); // 3–5, seeded
  return `## Summary
The council weighed "${topic}" from several angles and converged on a qualified, balanced position rather than a one-sided verdict.

## Key Conclusions
- The strongest opportunities around "${topic}" are real but contingent on execution.
- The most material risks are identifiable and can be mitigated rather than avoided.
- A phased approach lets the team validate assumptions before over-committing.

## Areas of Agreement
- Specialists agree a small, reversible first step beats an all-in commitment.
- There is consensus that the core idea is viable in principle.

## Areas of Disagreement
- Optimistic and sceptical voices diverge on how heavily to weight the downside.
- Views differ on sequencing: move fast to capture timing, or de-risk first.

## Risks and Limitations
- Resource constraints and timing pressure remain the dominant uncertainties.
- Some conclusions rest on assumptions that still need evidence.

## Recommendations
1. Launch a small, time-boxed pilot to test the riskiest assumption first.
2. Assign a named owner to each major risk with a concrete mitigation.
3. Set explicit go/no-go criteria before scaling beyond the pilot.

## Confidence Score
${confidence} — moderate-to-strong agreement, with a few evidence gaps keeping this short of full confidence.`;
}

function composeAnswerJudge(topic: string, rng: () => number): string {
  const leads = [
    `Here's a direct answer on "${topic}":`,
    `Short answer on "${topic}":`,
    `Straight to it for "${topic}":`,
  ];
  return `${pick(rng, leads)} the most practical default is to take one concrete, low-risk step now and adjust from what you learn.

A few good options:
1. Pick the smallest version you can ship this week and try it.
2. If you're unsure, default to the reversible choice — it keeps your options open.
3. Re-evaluate once you have real feedback rather than planning everything up front.

If your situation has a hard constraint I haven't accounted for, lead with that and the answer shifts accordingly.`;
}

function composePeerReview(
  userMessage: string,
  rng: () => number,
): string {
  const labels = extractResponseLabels(userMessage);
  const assessments = [
    "clear and well-reasoned, with concrete support",
    "solid overall but light on evidence in places",
    "thoughtful, though it leans on a few unstated assumptions",
    "useful and direct, if a little narrow in scope",
    "comprehensive but could be tightened for focus",
  ];
  const evaluations = labels
    .map((l) => `- ${l}: ${pick(rng, assessments)}.`)
    .join("\n");

  // Deterministic shuffle of the labels for the ranking.
  const ranked = [...labels].sort(
    () => rng() - 0.5,
  );
  const reasons = [
    "strongest balance of insight and evidence",
    "most actionable and clearly argued",
    "covers the trade-offs others missed",
    "reasonable but less complete than the rest",
    "thinner support than the others",
  ];
  const ranking = ranked
    .map((l, i) => `${i + 1}. ${l} — ${reasons[Math.min(i, reasons.length - 1)]}`)
    .join("\n");

  return `## Evaluations
${evaluations}

## Ranking
${ranking}`;
}

function composeDiscussionTurn(
  voice: Voice,
  topic: string,
  userMessage: string,
  rng: () => number,
): string {
  const { lastSpeaker } = extractDiscussionContext(userMessage);
  const openingMoves = [
    `Picking up on "${topic}", ${voice.stance.toLowerCase()}.`,
    `On "${topic}" — ${voice.stance}.`,
  ];
  const reactions = lastSpeaker
    ? [
        `${lastSpeaker} makes a fair point, but I'd push on ${voice.lens}.`,
        `I'd build on what ${lastSpeaker} said and add the angle of ${voice.lens}.`,
        `Where I part ways with ${lastSpeaker} is ${voice.lens}.`,
      ]
    : [
        `To open: the thing worth foregrounding is ${voice.lens}.`,
        `Let me start us off by focusing on ${voice.lens}.`,
      ];
  // Discussion turns must clear isDegenerateResponse (≥25 chars, no label
  // prefix) — three sentences comfortably does.
  return [pick(rng, openingMoves), pick(rng, reactions), voice.closer].join(
    " ",
  );
}

function composeDiscussionSummary(topic: string): string {
  return `The panel discussed "${topic}" and surfaced a few clear threads.

Participants largely agreed the core idea has merit, while differing on how much weight to give the risks and how fast to move. The optimistic view emphasised the upside and momentum; the more cautious voices pressed on assumptions, evidence and failure modes.

The strongest shared insight was that a small, reversible first step lets everyone test the riskiest assumption cheaply. The main open question is sequencing — capture timing now, or de-risk first.

Takeaway: proceed, but start narrow, instrument the result, and keep the path back open.`;
}

// ─── Code review (10X-CODE-REVIEW) — unchanged deterministic verdict ─

function composeCodeReview(diff: string): string {
  const added = diff
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .join("\n");
  const risky =
    /\b(eval|exec|child_process|dangerouslySetInnerHTML)\b|\$\{[^}]*\}|sql|query\(`/i.test(
      added,
    );
  const touchesTests = /\.(test|spec)\.[tj]sx?|__tests__|tests\//.test(diff);
  const security = risky ? 3 : 8;
  const coverage = touchesTests ? 8 : 5;
  const verdict = security <= 5 ? "fail" : "pass";
  return JSON.stringify({
    implementationCorrectness: 7,
    idiomaticity: 7,
    simplicity: 7,
    testRiskCoverage: coverage,
    securitySafety: security,
    verdict,
    summary: risky
      ? "Mock review: the diff introduces a potentially unsafe pattern (dynamic execution / string-built query). Failing closed on security pending a human check."
      : "Mock review: no high-risk patterns detected. Deterministic mock verdict for keyless demo — replace with OpenRouter for a real review.",
    findings: risky
      ? [
          {
            severity: "major",
            note: "Potentially unsafe dynamic/interpolated pattern in added lines.",
          },
        ]
      : [],
  });
}

// ─── Request routing ────────────────────────────────────────────────

/**
 * Picks the right composer from the system prompt's fingerprints. Order
 * matters: more specific markers (code review, judges, peer review) are checked
 * before the generic specialist fallback.
 */
function composeContent(input: GenerateInput, rng: () => number): string {
  const sys = input.systemPrompt;
  const sysLower = sys.toLowerCase();
  const topic = extractTopic(input.userMessage);

  if (sys.includes("10X-CODE-REVIEW")) {
    return composeCodeReview(input.userMessage);
  }
  // Discussion prompts wrap an agent persona (which may itself say "Final
  // Judge") with roundtable text, so check the discussion shapes BEFORE the
  // judge shapes — otherwise a summariser using a judge persona misroutes.
  // Discussion summariser ("summarize the entire … discussion").
  if (
    sysLower.includes("summarize the entire") &&
    sysLower.includes("discussion")
  ) {
    return composeDiscussionSummary(topic);
  }
  // Live roundtable turn.
  if (sysLower.includes("roundtable discussion")) {
    const { voice } = detectVoice(sysLower);
    return composeDiscussionTurn(voice, topic, input.userMessage, rng);
  }
  // Answer-mode judge: produces a direct user-facing answer, not a report.
  if (sysLower.includes("final answer judge")) {
    return composeAnswerJudge(topic, rng);
  }
  // Report-mode judge: structured ## sections the parser consumes.
  if (
    sysLower.includes("final judge") ||
    sysLower.includes("structured final report")
  ) {
    return composeReportJudge(topic, rng);
  }
  // Peer-review / ranking phase.
  if (sysLower.includes("impartial peer reviewer")) {
    return composePeerReview(input.userMessage, rng);
  }
  // Default: an independent specialist analysis.
  const { voice } = detectVoice(sysLower);
  return composeSpecialist(voice, topic, rng);
}

/**
 * Simulate a token cap: if the caller asked for fewer tokens than the content
 * needs (~4 chars/token), cut it off hard — no graceful ending — so callers
 * can exercise truncation-handling paths. Generous limits are a no-op.
 */
function applyTokenLimit(content: string, maxTokens?: number): string {
  if (!maxTokens || maxTokens <= 0) return content;
  const maxChars = maxTokens * 4;
  return content.length <= maxChars ? content : content.slice(0, maxChars);
}

// ─── Provider ───────────────────────────────────────────────────────

export class MockProvider implements LLMProvider {
  async generate(input: GenerateInput): Promise<GenerateOutput> {
    const start = performance.now();
    logger.debug("MockProvider.generate called", {
      model: "mock-provider",
      systemPromptLength: input.systemPrompt.length,
      userMessageLength: input.userMessage.length,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });

    // Deterministic seed from the exact request — same call, same output/latency.
    const rng = makeRng(hashSeed(input.systemPrompt + " " + input.userMessage));

    // Simulate network latency. Seeded (deterministic) by default, overridable
    // for tests; always abortable so cancellation works in demo/test mode.
    const delayMs =
      latencyOverrideMs ?? Math.round(30 + rng() * 190); // ~30–220ms
    await this.sleep(delayMs, input.signal);

    // A test-installed responder wins, unless it defers by returning undefined.
    if (customResponder) {
      const custom = await customResponder(input);
      if (custom !== undefined) {
        const out =
          typeof custom === "string"
            ? { content: custom, model: "mock-provider" }
            : custom;
        logger.debug("MockProvider.generate completed (scripted)", {
          model: out.model,
          durationMs: Math.round(performance.now() - start),
          responseLength: out.content.length,
        });
        return out;
      }
    }

    const content = applyTokenLimit(
      composeContent(input, rng),
      input.maxTokens,
    );

    logger.debug("MockProvider.generate completed", {
      model: "mock-provider",
      durationMs: Math.round(performance.now() - start),
      responseLength: content.length,
    });

    return { content, model: "mock-provider" };
  }

  /** Abortable delay — rejects with CouncilAbortedError if the signal fires. */
  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new CouncilAbortedError());
        return;
      }
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new CouncilAbortedError());
        },
        { once: true },
      );
    });
  }
}
