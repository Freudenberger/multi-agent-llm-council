import type { LLMProvider, GenerateInput, GenerateOutput } from "./types";
import { logger } from "../core/logger";

/**
 * Mock Provider — returns predefined responses without calling any external API.
 * Useful for demos, testing, and development without API keys.
 */

// Mock responses for specialist agents (unchanged) and structured responses for final judges.
const MOCK_SPECIALIST_RESPONSES: Record<string, string> = {
  optimist:
    "This is a fantastic opportunity! The potential benefits far outweigh the risks. With proper execution, this could lead to significant growth and positive outcomes. I'm confident that the team has the skills and resources to make this work successfully.",
  sceptic:
    "I have serious concerns about this proposal. There are multiple unaddressed risks, and the assumptions being made are overly optimistic. We need to carefully consider the failure modes and have concrete mitigation strategies before proceeding.",
  "risk analyst":
    "From a risk perspective, I've identified several key risk areas: resource constraints, timeline pressure, technical debt accumulation, and market uncertainty. Each of these needs a documented mitigation plan with clear ownership and escalation paths.",
  pragmatist:
    "Let's focus on what's actually achievable given our current constraints. We should prioritize the highest-impact, lowest-effort items first. A phased approach would allow us to validate assumptions before committing significant resources.",
  "creative thinker":
    "This idea has real potential! Let me suggest some creative extensions: we could combine this with emerging technologies, explore unconventional partnerships, or reframe the problem in a way that opens up entirely new solution spaces.",
  "market analyst":
    "Looking at market dynamics, there's a clear gap that this could fill. However, competition is intensifying. We need a strong differentiator and a clear go-to-market strategy. Timing is critical — the window of opportunity may be narrowing.",
  "technical feasibility reviewer":
    "Technically, this is achievable but not trivial. The main challenges are scalability, integration with existing systems, and maintaining performance under load. I'd recommend a proof-of-concept phase to validate the core technical approach.",
  "user perspective":
    "From the user's point of view, this solves a real pain point. However, the user experience needs to be intuitive and the value proposition immediately clear. Users won't tolerate a steep learning curve for marginal benefits.",
  "logic reviewer":
    "The argument has a generally sound structure, but there are a few logical gaps. The connection between the proposed solution and the stated problem could be more explicit. Some claims need stronger evidence.",
  "clarity reviewer":
    "Overall the message is understandable, but certain sections are overly complex. Simplifying the language and adding concrete examples would significantly improve clarity. The executive summary effectively captures the key points.",
  "evidence reviewer":
    "The evidence presented is partially convincing but lacks depth in critical areas. More data points, case studies, or expert opinions would strengthen the argument. Some claims appear to be based on outdated information.",
  teacher:
    "Let me explain this concept step by step. At its core, this is about understanding how different components interact within a system. Think of it like building blocks — each piece has a specific role, and when combined correctly, they create something greater than the sum of their parts.",
  beginner:
    "I'm just starting to learn about this, and I find the terminology confusing. Could someone explain what this means in simpler terms? I understand the basic idea but struggle with the technical details and how everything connects.",
  examiner:
    "Key questions to test understanding: 1) What are the fundamental principles at work here? 2) How would you apply this in a real-world scenario? 3) What are the common misconceptions? 4) How does this relate to other concepts in the field?",
  "example generator":
    "Here are some practical examples: First, consider a small team building a web application — they might choose a monolithic architecture for simplicity. Second, a large enterprise might need microservices for scalability. Third, a startup might begin with a simple serverless approach.",
  "software architect":
    "From an architecture perspective, the proposed design has good separation of concerns. However, I'd recommend considering: API versioning strategy, data flow patterns, and failure isolation. The modular approach is sound but needs clearer interface definitions.",
  "security reviewer":
    "Security analysis reveals several areas needing attention: input validation, authentication flows, data encryption at rest and in transit, and audit logging. The overall approach is reasonable but security should be integrated earlier in the design process.",
  "performance reviewer":
    "Performance considerations: the current design should handle expected load, but I'd recommend adding caching layers, optimizing database queries, and implementing rate limiting. Load testing should be conducted before production deployment.",
  "maintainability reviewer":
    "Code maintainability looks good — the modular structure and clear naming conventions will help. I'd suggest adding more comprehensive documentation, increasing test coverage, and establishing coding standards for the team.",
};

// Structured mock responses for final judges. The format matches what the parser expects.
const MOCK_JUDGE_RESPONSES: Record<string, string> = {
  "final judge": `## Summary
The council presents a balanced view, highlighting both opportunities and risks.

## Key Conclusions
- Opportunity is significant but requires mitigation of identified risks.
- Implementation should be phased to validate assumptions.

## Areas of Agreement
- All specialists agree on the need for a pilot phase.

## Areas of Disagreement
- Optimist emphasizes upside, while Sceptic stresses potential failure modes.

## Risks and Limitations
- Resource constraints and market uncertainty remain critical.

## Recommendations
1. Launch a small‑scale pilot.
2. Develop detailed risk mitigation plans.
3. Monitor outcomes before scaling.

## Confidence Score
4`,
  "final synthesizer": `## Summary
The idea shows promise with clear market potential and technical feasibility.

## Key Conclusions
- Strong market gap identified.
- Technical challenges are manageable with a proof‑of‑concept.

## Areas of Agreement
- Need for user‑centric design.

## Areas of Disagreement
- Creative extensions vs. core MVP scope.

## Risks and Limitations
- Competitive landscape is intense.

## Recommendations
1. Validate core functionality with early users.
2. Define a unique value proposition.
3. Plan incremental feature rollout.

## Confidence Score
3`,
  "final editor": `## Summary
The document is solid but requires stronger evidence and clearer transitions.

## Key Conclusions
- Core argument is sound.
- Evidence gaps need addressing.

## Areas of Agreement
- Structure is logical.

## Areas of Disagreement
- Depth of evidence varies across sections.

## Risks and Limitations
- Potential credibility issues due to outdated references.

## Recommendations
1. Add recent case studies.
2. Strengthen data citations.
3. Improve section flow.

## Confidence Score
3`,
  "final explainer": `## Summary
The concept requires careful trade‑off analysis; no single solution fits all contexts.

## Key Conclusions
- Evaluate constraints before choosing an approach.
- Iterative experimentation is valuable.

## Areas of Agreement
- Importance of context‑driven decisions.

## Areas of Disagreement
- Preferred emphasis on speed vs. robustness.

## Risks and Limitations
- Over‑engineering may waste resources.

## Recommendations
1. Map constraints to possible architectures.
2. Prototype key assumptions.
3. Review outcomes before scaling.

## Confidence Score
4`,
  "final recommender": `## Summary
Proceed with the architecture, prioritizing security and performance improvements.

## Key Conclusions
- Architecture is viable.
- Immediate focus on security and performance.

## Areas of Agreement
- Need for monitoring and iterative refinement.

## Areas of Disagreement
- Timing of feature expansion.

## Risks and Limitations
- Potential performance bottlenecks if not addressed early.

## Recommendations
1. Implement security hardening.
2. Add performance monitoring.
3. Plan phased feature rollout.

## Confidence Score
4`,
};

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

    // Simulate network delay
    const delayMs = 300 + Math.random() * 700;
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Determine whether this is a final‑judge request or a specialist request.
    const systemLower = input.systemPrompt.toLowerCase();
    let content =
      "This is a mock response. In production, this would be generated by a real LLM provider.";

    // First check for final judge keys (exact match on known judge identifiers).
    const judgeKey = Object.keys(MOCK_JUDGE_RESPONSES).find((k) =>
      systemLower.includes(k),
    );
    if (judgeKey) {
      content = MOCK_JUDGE_RESPONSES[judgeKey];
    } else {
      // Fall back to specialist responses.
      for (const [key, value] of Object.entries(MOCK_SPECIALIST_RESPONSES)) {
        if (systemLower.includes(key.toLowerCase())) {
          content = value;
          break;
        }
      }
    }

    const durationMs = Math.round(performance.now() - start);
    logger.debug("MockProvider.generate completed", {
      model: "mock-provider",
      durationMs,
      responseLength: content.length,
    });

    return {
      content,
      model: "mock-provider",
    };
  }
}
