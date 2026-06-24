import { describe, expect, it } from "vitest";

import { repairEditorMacroSyntax } from "./editorMacroRepair";

describe("repairEditorMacroSyntax", () => {
  it("removes stray backticks around highlight macros", () => {
    const input = "VibeCount` \\hl{yellow}{first rotates the grid} `with the axes.";
    expect(repairEditorMacroSyntax(input)).toBe(
      "VibeCount \\hl{yellow}{first rotates the grid} with the axes.",
    );
  });

  it("repairs bare encoded highlight tokens", () => {
    const input = "to measure` ⟦hl:yellow:its size, all at full resolution⟧`.";
    expect(repairEditorMacroSyntax(input)).toContain("\\hl{yellow}{its size, all at full resolution}");
  });

  it("deduplicates corrupted ref suffixes", () => {
    expect(repairEditorMacroSyntax("(Fig. \\\\ref{fig:system}fig:systemA).")).toBe(
      "(Fig. \\ref{fig:system}).",
    );
  });

  it("repairs broken encoded ref tokens", () => {
    expect(repairEditorMacroSyntax("(Fig. \\`§ref:fig:system§\\`fig:systemB).")).toBe(
      "(Fig. \\ref{fig:system}).",
    );
  });

  it("renders bare microliter LaTeX as unicode", () => {
    expect(repairEditorMacroSyntax("zone whose 0.1~\\\\mu\\text{L}volume")).toBe(
      "zone whose 0.1 µLvolume",
    );
  });

  it("collapses duplicate figure embed lines", () => {
    const input = "Paragraph.\n\n::figure[papers/demo/fig1]\n::figure[papers/demo/fig1]\n\n";
    expect(repairEditorMacroSyntax(input)).toBe("Paragraph.\n\n::figure[papers/demo/fig1]\n\n");
  });

  it("repairs the workflow overview draft excerpt", () => {
    const input =
      "workflow (Fig. \\\\ref{fig:system}fig:systemA). so VibeCount` \\hl{yellow}{first rotates the image to square the ruled grid} `with the image axes. zone whose 0.1~\\\\mu\\text{L}volume and to measure` ⟦hl:yellow:itssize, all at full resolution⟧`.";
    const fixed = repairEditorMacroSyntax(input);
    expect(fixed).toContain("\\ref{fig:system}");
    expect(fixed).not.toContain("fig:systemA");
    expect(fixed).toContain("\\hl{yellow}{first rotates the image to square the ruled grid}");
    expect(fixed).toContain("0.1 µL");
    expect(fixed).not.toContain("` \\hl{");
  });
});
