import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs, formatReport, loadEnvFiles } from "@/cli/index";
import { runCouncil } from "@/core/runCouncil";

describe("CLI parseArgs", () => {
  it("defaults to decision mode with no flags", () => {
    const parsed = parseArgs(["What should we build?"]);
    expect(parsed).toEqual({
      mode: "decision",
      outputJson: false,
      peerReview: false,
      inputText: "What should we build?",
    });
  });

  it("parses --mode", () => {
    expect(parseArgs(["--mode", "technical", "Q"]).mode).toBe("technical");
  });

  it("parses --json and --peer-review flags in any position", () => {
    const parsed = parseArgs(["--json", "Q", "--peer-review"]);
    expect(parsed.outputJson).toBe(true);
    expect(parsed.peerReview).toBe(true);
    expect(parsed.inputText).toBe("Q");
  });

  it("reads and trims input from --input-file via injected reader", () => {
    const parsed = parseArgs(["--input-file", "prompt.txt"], () => "  hello  \n");
    expect(parsed.inputText).toBe("hello");
  });

  it("leaves inputText empty when only flags are passed", () => {
    expect(parseArgs(["--list-modes"]).inputText).toBe("");
  });

  it("lets the last input source win (positional after --input-file)", () => {
    const parsed = parseArgs(["--input-file", "f.txt", "positional"], () => "fromfile");
    expect(parsed.inputText).toBe("positional");
  });

  it("ignores a --mode flag with no value following it", () => {
    expect(parseArgs(["--mode"]).mode).toBe("decision");
  });

  it("parses a combined real-world invocation", () => {
    const parsed = parseArgs(["--mode", "swot", "--peer-review", "--json", "Topic"]);
    expect(parsed).toEqual({
      mode: "swot",
      outputJson: true,
      peerReview: true,
      inputText: "Topic",
    });
  });
});

describe("CLI loadEnvFiles", () => {
  const dir = join(tmpdir(), "council-cli-env-test");
  const local = join(dir, ".env.local");
  const base = join(dir, ".env");
  const keys = ["COUNCIL_TEST_FOO", "COUNCIL_TEST_PRECEDENCE"];

  afterEach(() => {
    for (const k of keys) delete process.env[k];
    rmSync(dir, { recursive: true, force: true });
  });

  it("loads vars from an env file into process.env", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(base, "COUNCIL_TEST_FOO=bar\n");

    const added = loadEnvFiles([base]);

    expect(process.env.COUNCIL_TEST_FOO).toBe("bar");
    expect(added).toContain("COUNCIL_TEST_FOO");
  });

  it("does not override a var already set in process.env", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(base, "COUNCIL_TEST_FOO=from-file\n");
    process.env.COUNCIL_TEST_FOO = "from-shell";

    loadEnvFiles([base]);

    expect(process.env.COUNCIL_TEST_FOO).toBe("from-shell");
  });

  it("gives .env.local precedence over .env", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(local, "COUNCIL_TEST_PRECEDENCE=local\n");
    writeFileSync(base, "COUNCIL_TEST_PRECEDENCE=base\n");

    loadEnvFiles([local, base]);

    expect(process.env.COUNCIL_TEST_PRECEDENCE).toBe("local");
  });

  it("does not throw when the env files are missing", () => {
    expect(() => loadEnvFiles([join(dir, "nope.env")])).not.toThrow();
  });
});

describe("CLI formatReport", () => {
  it("renders a human-readable report from a real council run", async () => {
    const result = await runCouncil({
      input: "Should we adopt TypeScript?",
      mode: "decision",
    });

    const report = formatReport(result);

    expect(report).toContain("COUNCIL ANALYSIS REPORT");
    expect(report).toContain("Mode: DECISION");
    expect(report).toContain("Should we adopt TypeScript?");
    expect(report).toContain("FINAL SYNTHESIS");
    expect(report).toContain(`CONFIDENCE SCORE: ${result.finalReport.confidence}/5`);
  });

  it("includes the peer-review section when peerReview is enabled", async () => {
    const result = await runCouncil({
      input: "Should we adopt TypeScript?",
      mode: "decision",
      peerReview: true,
    });

    const report = formatReport(result);
    expect(report).toContain("PEER REVIEW & RANKING");
  });
});
