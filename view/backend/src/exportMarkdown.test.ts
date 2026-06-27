import { describe, expect, it } from "vitest";

import { buildInlineNoteLatexPreamble } from "./inlineNotes.js";
import { prepareMarkdownForLatexExport } from "./exportMarkdown.js";

describe("prepareMarkdownForLatexExport", () => {
  it("converts highlights and keeps real latex refs", () => {
    const input =
      "See Fig. \\\\ref{fig:system}fig:systemA and \\\\hl{yellow}{rotate grid} here.";
    const output = prepareMarkdownForLatexExport(input);
    expect(output).toContain("\\ref{fig:system}");
    expect(output).toContain("\\textcolor{twyellow}{rotate grid}");
    expect(output).not.toContain("\\\\hl");
    expect(output).not.toContain("fig:systemA");
  });

  it("does not stub export highlights when preamble scans source markdown", () => {
    const source = "\\hl{yellow}{term} Fig. \\ref{fig:a} \\iy{fix}";
    const prepared = prepareMarkdownForLatexExport(source);
    expect(prepared).toContain("\\textcolor{twyellow}{term}");

    const preambleFromSource = buildInlineNoteLatexPreamble(source);
    expect(preambleFromSource).not.toContain("\\providecommand{\\hl}");
    expect(preambleFromSource).not.toContain("\\providecommand{\\ref}");
    expect(preambleFromSource).not.toContain("\\providecommand{\\textcolor}");
    expect(preambleFromSource).toContain("\\providecommand{\\iy}");
  });

  it("repairs workflow_overview-style corruption", () => {
    const corrupted =
      "measure its si`⟦hl:yellow:ze, all at full resolution. Cells are counted by the⟧ `standard rule";
    expect(prepareMarkdownForLatexExport(corrupted)).toContain(
      "\\textcolor{twyellow}{size, all at full resolution. Cells are counted by the}",
    );
  });

  it("fixes microliter duplication", () => {
    const input = "zone whose 0.1 µL0.1~\\mu\\text{L}0.1 µL volume";
    expect(prepareMarkdownForLatexExport(input)).toContain("$0.1~\\mu\\mathrm{L}$");
    expect(prepareMarkdownForLatexExport(input)).not.toContain("µL0.1");
    expect(prepareMarkdownForLatexExport(input)).not.toContain("\\mu\\text{L}");
  });

  it("wraps microliter and normalizes unicode math symbols", () => {
    const input =
      "whose 0.1~\\mu\\text{L} volume, $560 × 560$ px, 10 $µ$L, $5 × 10^{6}$, avoiding the $\\sim$4.6$×$ shrinkage, T1$→$T2.";
    const output = prepareMarkdownForLatexExport(input);
    expect(output).toContain("$0.1~\\mu\\mathrm{L}$");
    expect(output).toContain("$560 \\times 560$");
    expect(output).toContain("$10~\\mu\\mathrm{L}$");
    expect(output).toContain("$5 \\times 10^{6}$");
    expect(output).toContain("$\\sim 4.6\\times$");
    expect(output).toContain("$\\to$");
    expect(output).not.toContain("×");
    expect(output).not.toContain("µ");
  });
});
