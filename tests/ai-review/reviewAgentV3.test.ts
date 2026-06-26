import { describe, it, expect } from "vitest";
import {
  resolveRepoPath,
  extractCost,
} from "../../tools/ai-review/v3/reviewAgentV3";

// The read_repo_file tool feeds an LLM-controlled path into the filesystem —
// a trust boundary. resolveRepoPath is the guard, so it gets the test.
describe("resolveRepoPath (path-traversal guard)", () => {
  const root = process.platform === "win32" ? "C:\\repo" : "/repo";

  it("allows a plain repo-relative path", () => {
    expect(resolveRepoPath(root, "src/core/runCouncil.ts")).not.toBeNull();
  });

  it("allows the root itself", () => {
    expect(resolveRepoPath(root, ".")).toBe(root);
  });

  it("rejects parent-directory traversal", () => {
    expect(resolveRepoPath(root, "../secrets.txt")).toBeNull();
    expect(resolveRepoPath(root, "src/../../etc/passwd")).toBeNull();
  });

  it("rejects an absolute path outside the root", () => {
    const outside = process.platform === "win32" ? "C:\\Windows\\win.ini" : "/etc/passwd";
    expect(resolveRepoPath(root, outside)).toBeNull();
  });

  it("does not treat a sibling dir sharing a prefix as inside", () => {
    // "C:\repo-evil" / "/repo-evil" must NOT count as inside "/repo".
    expect(resolveRepoPath(root, "../repo-evil/x")).toBeNull();
  });
});

describe("extractCost", () => {
  it("reads OpenRouter cost from provider metadata", () => {
    expect(extractCost({ openrouter: { usage: { cost: 0.0012 } } })).toBe(0.0012);
  });
  it("returns undefined when absent", () => {
    expect(extractCost(undefined)).toBeUndefined();
    expect(extractCost({ openrouter: {} })).toBeUndefined();
  });
});
