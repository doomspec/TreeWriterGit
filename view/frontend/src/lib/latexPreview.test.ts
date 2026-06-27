import { describe, expect, it } from "vitest";

import { clearLatexPreviewCache, preprocessLatexForMarkdownPreview } from "./latexPreview";

describe("preprocessLatexForMarkdownPreview", () => {
  it("converts textbf to markdown bold", () => {
    const input = String.raw`\textbf{Why:} manual counting`;
    expect(preprocessLatexForMarkdownPreview(input)).toBe("**Why:** manual counting");
  });

  it("escapes asterisks inside textbf so markdown bold still parses", () => {
    const input = String.raw`\textbf{*** MOST IMPACTFUL POINT (make this the star):}`;
    expect(preprocessLatexForMarkdownPreview(input)).toBe(
      String.raw`**\*\*\* MOST IMPACTFUL POINT (make this the star):**`,
    );
  });

  it("bolds why/what/so-what labels in planning prose", () => {
    const input = String.raw`\textbf{Why:} gap. \textbf{What:} tool. \textbf{So what:} impact.`;
    expect(preprocessLatexForMarkdownPreview(input)).toBe(
      "**Why:** gap. **What:** tool. **So what:** impact.",
    );
  });

  it("converts arrows and stats in inline math (markdown mode)", () => {
    const input = "Intro $\\to$ Results ($p<0.001$)";
    expect(preprocessLatexForMarkdownPreview(input)).toBe("Intro → Results (*p* < 0.001)");
  });

  it("renders inline math as HTML when requested", () => {
    const html = preprocessLatexForMarkdownPreview(String.raw`$\to$`, { math: "html" });
    expect(html).toContain("katex");
  });

  it("normalizes LaTeX non-breaking spaces", () => {
    const input = "median 410~s, Fig.~1";
    const out = preprocessLatexForMarkdownPreview(input);
    expect(out).toContain("410\u00a0s");
    expect(out).toContain("Fig.\u00a01");
  });

  it("renders µL when math delimiters close before L", () => {
    expect(preprocessLatexForMarkdownPreview("volume of $0.1 µ$L")).toBe("volume of 0.1 µL");
    expect(preprocessLatexForMarkdownPreview("10 $µ$L of suspension")).toBe("10 µL of suspension");
    expect(preprocessLatexForMarkdownPreview(String.raw`$0.1~\mu$L zone`)).toBe("0.1 µL zone");
  });

  it("renders µL as KaTeX in html mode", () => {
    clearLatexPreviewCache();
    const html = preprocessLatexForMarkdownPreview("$0.1 µ$L", { math: "html" });
    expect(html).toContain("katex");
    expect(html).not.toMatch(/katex[\s\S]*<\/span>L\b/);
  });

  it("renders micrometers when math closes before m", () => {
    expect(preprocessLatexForMarkdownPreview("scale bar, 200 $µ$m")).toBe("scale bar, 200 µm");
    expect(preprocessLatexForMarkdownPreview("threshold (default 30 $µ$m)")).toBe(
      "threshold (default 30 µm)",
    );
    expect(preprocessLatexForMarkdownPreview("10 $µ$L of suspension")).toBe("10 µL of suspension");
    expect(preprocessLatexForMarkdownPreview("threshold (default $30 µ$m)")).toBe(
      "threshold (default 30 µm)",
    );
    expect(preprocessLatexForMarkdownPreview("volume $0.1 µ$L zone")).toBe("volume 0.1 µL zone");
  });

  it("renders micrometers as KaTeX in html mode without console warnings", () => {
    clearLatexPreviewCache();
    const warn = console.warn;
    const warnings: unknown[] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    try {
      const html = preprocessLatexForMarkdownPreview(
        "200 $µ$m, $30 µ$m, and volume $0.1 µ$L",
        { math: "html" },
      );
      expect(html).toContain("katex");
      expect(warnings.join(" ")).not.toContain("No character metrics for");
    } finally {
      console.warn = warn;
    }
  });
});
