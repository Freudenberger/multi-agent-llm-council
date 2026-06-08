#!/usr/bin/env tsx

/**
 * CLI for the Multi-Agent LLM Council.
 * Uses the same Council Core as the web application.
 *
 * Usage:
 *   npm run council -- "Your question here"
 *   npm run council -- --mode decision "Your question here"
 *   npm run council -- --mode technical "Your question here"
 *   npm run council -- --list-modes
 */

import { runCouncil } from "../core/runCouncil";
import { logger } from "../core/logger";
import { listModes } from "../modes";

function printUsage(): void {
  console.log(`
Multi-Agent LLM Council CLI

Usage:
  council "Your question or topic"
  council --mode <mode> "Your question or topic"
  council --list-modes
  council --help

Modes:
  decision        - Analyze a decision from multiple perspectives
  idea            - Evaluate an idea's potential and feasibility
  criticalReview  - Review text, arguments, or proposals
  learning        - Get educational explanations
  technical       - Evaluate technical topics and architecture

Options:
  --mode <mode>   Select council mode (default: decision)
  --list-modes    List all available council modes
  --json          Output result as JSON
  --help          Show this help message
`);
}

function printModes(): void {
  const modes = listModes();
  console.log("Available Council Modes:\n");
  for (const mode of modes) {
    console.log(`  ${mode.id.padEnd(16)} ${mode.name}`);
    console.log(`  ${"".padEnd(16)} ${mode.description}`);
    console.log(
      `  ${"".padEnd(16)} Agents: ${mode.agents.map((a) => a.name).join(", ")}`,
    );
    console.log();
  }
}

function formatReport(result: Awaited<ReturnType<typeof runCouncil>>): string {
  const report = result.finalReport;

  const lines: string[] = [];
  lines.push("=".repeat(70));
  lines.push(`  COUNCIL ANALYSIS REPORT`);
  lines.push(`  Mode: ${result.modeId.toUpperCase()}`);
  lines.push(`  Date: ${new Date(result.createdAt).toLocaleString()}`);
  lines.push("=".repeat(70));
  lines.push("");

  lines.push(`QUESTION/INPUT:`);
  lines.push(`  ${result.userInput}`);
  lines.push("");

  lines.push("-".repeat(70));
  lines.push("INDIVIDUAL AGENT RESPONSES");
  lines.push("-".repeat(70));

  for (const response of result.agentResponses) {
    lines.push("");
    lines.push(`  [${response.agentName}]`);
    lines.push(`  ${response.content}`);
    lines.push("");
  }

  lines.push("-".repeat(70));
  lines.push("FINAL SYNTHESIS");
  lines.push("-".repeat(70));
  lines.push("");

  if (report.summary) {
    lines.push(`SUMMARY:`);
    lines.push(`  ${report.summary}`);
    lines.push("");
  }

  if (report.keyConclusions.length > 0) {
    lines.push(`KEY CONCLUSIONS:`);
    for (const c of report.keyConclusions) {
      lines.push(`  • ${c}`);
    }
    lines.push("");
  }

  if (report.agreements.length > 0) {
    lines.push(`AREAS OF AGREEMENT:`);
    for (const a of report.agreements) {
      lines.push(`  ✓ ${a}`);
    }
    lines.push("");
  }

  if (report.disagreements.length > 0) {
    lines.push(`AREAS OF DISAGREEMENT:`);
    for (const d of report.disagreements) {
      lines.push(`  ✗ ${d}`);
    }
    lines.push("");
  }

  if (report.risks.length > 0) {
    lines.push(`RISKS AND LIMITATIONS:`);
    for (const r of report.risks) {
      lines.push(`  ⚠ ${r}`);
    }
    lines.push("");
  }

  if (report.recommendations.length > 0) {
    lines.push(`RECOMMENDATIONS:`);
    report.recommendations.forEach((r, i) => {
      lines.push(`  ${i + 1}. ${r}`);
    });
    lines.push("");
  }

  lines.push(`CONFIDENCE SCORE: ${report.confidence}/5`);
  lines.push("");
  lines.push("=".repeat(70));

  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    printUsage();
    process.exit(0);
  }

  if (args.includes("--list-modes")) {
    printModes();
    process.exit(0);
  }

  let mode: "decision" | "idea" | "criticalReview" | "learning" | "technical" =
    "decision";
  let outputJson = false;
  let inputText = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--mode" && args[i + 1]) {
      mode = args[++i] as typeof mode;
    } else if (args[i] === "--json") {
      outputJson = true;
    } else if (!args[i].startsWith("--")) {
      inputText = args[i];
    }
  }

  if (!inputText) {
    console.error("Error: No input text provided.");
    console.error('Usage: council "Your question or topic"');
    process.exit(1);
  }

  logger.info("CLI council run started", {
    mode,
    inputLength: inputText.length,
  });
  console.log(`\n🏛️  Running ${mode} council analysis...\n`);

  try {
    const result = await runCouncil({ input: inputText, mode });

    if (outputJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatReport(result));
    }

    logger.info("CLI council run completed", {
      runId: result.id,
      mode: result.modeId,
      confidence: result.finalReport.confidence,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("CLI council run failed", { error: errorMessage });
    console.error("Error:", errorMessage);
    process.exit(1);
  }
}

main();
