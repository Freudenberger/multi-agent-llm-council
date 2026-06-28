import { describe, it, expect } from "vitest";
import { safeHref } from "@/app/components/Markdown";

describe("safeHref", () => {
  it("passes through safe schemes", () => {
    for (const href of [
      "https://example.com",
      "http://example.com/x?y=1",
      "mailto:a@b.com",
      "/relative/path",
      "#anchor",
    ]) {
      expect(safeHref(href)).toBe(href);
    }
  });

  it("neutralizes script-bearing schemes to #", () => {
    for (const href of [
      "javascript:alert(1)",
      "  JavaScript:alert(1)", // leading space + mixed case
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
    ]) {
      expect(safeHref(href)).toBe("#");
    }
  });
});
