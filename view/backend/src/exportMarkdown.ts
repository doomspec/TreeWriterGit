/** Normalize TreeWriter draft markdown before pandoc LaTeX export. */

const TEXT_HIGHLIGHT_PATTERN = /\\hl\{([a-z]+)\}\{([^}]*)\}/g;

const HL_LATEX_COLORS: Record<string, string> = {
  yellow: "twyellow",
  green: "twgreen",
  blue: "twblue",
  pink: "twpink",
  orange: "tworange",
  purple: "twpurple",
};

const REF_TOKEN_PATTERN = /`§ref:([^`]*?)§`/g;
const LABEL_TOKEN_PATTERN = /`§label:([^`]*?)§`/g;
const ENCODED_HL_PATTERN = /`⟦hl:([a-z]+):([\s\S]*?)⟧\s*`/g;
const BARE_ENCODED_HL_PATTERN = /(?<![`])⟦hl:([a-z]+):([\s\S]*?)⟧(?![`])/g;
const SPLIT_PREFIX_ENCODED_HL_PATTERN =
  /([a-z]{1,3})`⟦hl:([a-z]+):([a-z][\s\S]*?)⟧\s*`/g;

/** LaTeX commands that must not become inline author-note macros in export. */
export const RESERVED_INLINE_NOTE_COMMANDS = new Set([
  "begin",
  "end",
  "cite",
  "emph",
  "figure",
  "hl",
  "label",
  "ref",
  "sqrt",
  "text",
  "textbf",
  "textit",
  "textcolor",
  "color",
  "todo",
  "caption",
  "includegraphics",
  "centering",
  "mu",
]);

export function normalizeTextHighlightMacros(markdown: string): string {
  let result = markdown;
  while (/\\\\hl\{/.test(result)) {
    result = result.replace(/\\\\hl\{/g, "\\hl{");
  }
  result = result.replace(BARE_ENCODED_HL_PATTERN, (_full, color: string, text: string) => {
    return `\`⟦hl:${color}:${text}⟧\``;
  });
  result = result.replace(SPLIT_PREFIX_ENCODED_HL_PATTERN, (_full, prefix: string, color: string, inner: string) => {
    return `\\hl{${color}}{${prefix}${inner}}`;
  });
  result = result.replace(
    /([A-Za-z]{1,40})\\hl\{([a-z]+)\}\{([a-z][^}]*)\}/g,
    (_full, prefix: string, color: string, inner: string) => {
      return `\\hl{${color}}{${prefix}${inner}}`;
    },
  );
  return result;
}

function normalizeDoubleEscapedLatex(markdown: string): string {
  let result = markdown;
  for (const command of ["ref", "label", "hl", "cite", "text", "sqrt", "begin", "end"]) {
    result = result.replace(new RegExp(`\\\\\\\\${command}\\{`, "g"), `\\${command}{`);
  }
  return result;
}

function restoreEncodedHighlights(markdown: string): string {
  return markdown.replace(ENCODED_HL_PATTERN, (_full, color: string, text: string) => {
    return `\\hl{${color}}{${text}}`;
  });
}

function restoreLatexRefTokens(markdown: string): string {
  return markdown
    .replace(REF_TOKEN_PATTERN, (_full, key: string) => `\\ref{${key}}`)
    .replace(LABEL_TOKEN_PATTERN, (_full, key: string) => `\\label{${key}}`);
}

/** Convert `\hl{color}{text}` to `\textcolor{twcolor}{text}` for PDF export. */
export function convertTextHighlightsToLatex(markdown: string): string {
  return markdown.replace(TEXT_HIGHLIGHT_PATTERN, (_full, color: string, text: string) => {
    const latexColor = HL_LATEX_COLORS[color.toLowerCase()] ?? HL_LATEX_COLORS.yellow;
    return `\\textcolor{${latexColor}}{${text}}`;
  });
}

/** Fix duplicated / split microliter units from editor roundtrips. */
export function fixMicroliterUnitsForExport(text: string): string {
  let result = text.replace(
    /(\d+(?:\.\d+)?)\s*(?:µ|μ|uL|L)[^\S\r\n]*(?:\1~?\\mu\\text\{L\}|0\.1~\\mu\\text\{L\})/gi,
    "$1~\\mu\\mathrm{L}",
  );
  result = result.replace(/(\d+(?:\.\d+)?)\s*(?:µ|μ)L(?:\1~?\\mu\\text\{L\})?/g, "$1~\\mu\\mathrm{L}");
  result = result.replace(/0\.1\s*(?:µ|μ)L0\.1~\\mu\\text\{L\}0\.1\s*(?:µ|μ)L/g, "0.1~\\mu\\mathrm{L}");
  result = result.replace(/(\d+(?:\.\d+)?)~?\\mu\\text\{L\}/g, "$1~\\mu\\mathrm{L}");
  result = result.replace(/(\d+(?:\.\d+)?)\s*[µμ]L\b/g, "$1~\\mu\\mathrm{L}");
  return wrapBareLatexUnitsInMath(result);
}

/** Wrap bare `N~\mu\mathrm{L}` / `N~\mu\mathrm{m}` tokens in `$...$` for pandoc. */
export function wrapBareLatexUnitsInMath(text: string): string {
  return text
    .replace(/(?<!\$)(\d+(?:\.\d+)?)~\\mu\\mathrm\{L\}(?!\$)/g, "$$$1~\\mu\\mathrm{L}$")
    .replace(/(?<!\$)(\d+(?:\.\d+)?)~\\mu\\mathrm\{m\}(?!\$)/g, "$$$1~\\mu\\mathrm{m}$");
}

/** Repair editor patterns like `10 $µ$L` or `30 $µ$m`. */
export function fixSplitUnicodeUnitTokens(text: string): string {
  let result = text;
  result = result.replace(/(\d+(?:\.\d+)?)\s*\$[µμ]\$\s*L\b/g, "$1~\\mu\\mathrm{L}");
  result = result.replace(/(\d+(?:\.\d+)?)\s*\$[µμ]\$\s*m\b/g, "$1~\\mu\\mathrm{m}");
  result = result.replace(/(\d+(?:\.\d+)?)\s*\$[µμ]\$\s*L\b/g, "$1~\\mu\\mathrm{L}");
  return wrapBareLatexUnitsInMath(result);
}

/** Repair `10 µm` / `30 μm` outside math. */
export function fixMicrometerUnitsForExport(text: string): string {
  const result = text.replace(/(\d+(?:\.\d+)?)\s*[µμ]m\b/g, "$1~\\mu\\mathrm{m}");
  return wrapBareLatexUnitsInMath(result);
}

/** Merge broken adjacent math fragments such as `$\sim$4.6$×$`. */
export function fixAdjacentMathFragments(text: string): string {
  let result = text;
  result = result.replace(/\$\\sim\$([\d.]+)\$\s*[×x]\s*\$/g, "$\\sim $1\\times$");
  result = result.replace(/\$\\sim\$([\d.]+)\s*[×x]\s*\$/g, "$\\sim $1\\times$");
  result = result.replace(/(\d+)\$\s*[×x]\s*\$/g, "$$$1\\times$$");
  result = result.replace(/\$\s*[×x]\s*\$/g, "$\\times$");
  result = result.replace(/\$\s*→\s*\$/g, "$\\to$");
  result = result.replace(/\$\s*[→]\s*\$/g, "$\\to$");
  return result;
}

/** Normalize unicode and loose symbols inside `$...$` segments. */
export function normalizeInlineMathSegments(text: string): string {
  return text.replace(/\$(?![$])([^$\n]+?)\$/g, (_full, inner: string) => {
    let normalized = inner;
    normalized = normalized.replace(/[×x]/g, "\\times ");
    normalized = normalized.replace(/[→]/g, "\\to ");
    normalized = normalized.replace(/[µμ]/g, "\\mu");
    normalized = normalized.replace(/\\mu\s*mathrm\{m\}/g, "\\mu\\mathrm{m}");
    normalized = normalized.replace(/\\mu\s*mathrm\{L\}/g, "\\mu\\mathrm{L}");
    normalized = normalized.replace(/\\mu\s+m\b/g, "\\mu\\mathrm{m}");
    normalized = normalized.replace(/\\mu\s+L\b/g, "\\mu\\mathrm{L}");
    normalized = normalized.replace(/\s+/g, " ").trim();
    return `$${normalized}$`;
  });
}

/** Remove duplicated label keys after `\ref{key}` (e.g. `\ref{fig:system}fig:systemA` → `\ref{fig:system}A`). */
export function fixDuplicatedRefSuffixes(text: string): string {
  return text.replace(/\\ref\{([^}]+)\}\1([A-Za-z0-9]*)/g, (_full, key: string, suffix: string) => {
    return `\\ref{${key}}${suffix}`;
  });
}

/** Drop placeholder figure environments that have no content. */
export function stripPlaceholderFigures(text: string): string {
  return text.replace(/\\begin\{figure\}\[ht!?\]\s*(?=\\begin\{figure\}|$|\n\n|[A-Z])/g, "");
}

export function buildHighlightColorLatexPreamble(): string {
  return [
    "\\usepackage{xcolor}",
    "\\definecolor{twyellow}{RGB}{254,240,138}",
    "\\definecolor{twgreen}{RGB}{167,243,208}",
    "\\definecolor{twblue}{RGB}{186,230,253}",
    "\\definecolor{twpink}{RGB}{254,205,211}",
    "\\definecolor{tworange}{RGB}{254,215,170}",
    "\\definecolor{twpurple}{RGB}{221,214,254}",
  ].join("\n");
}

/** Full markdown cleanup pipeline before pandoc export. */
export function prepareMarkdownForLatexExport(markdown: string): string {
  let result = markdown;
  result = normalizeDoubleEscapedLatex(result);
  result = normalizeTextHighlightMacros(result);
  result = restoreEncodedHighlights(result);
  result = restoreLatexRefTokens(result);
  result = fixSplitUnicodeUnitTokens(result);
  result = fixMicroliterUnitsForExport(result);
  result = fixMicrometerUnitsForExport(result);
  result = fixAdjacentMathFragments(result);
  result = normalizeInlineMathSegments(result);
  result = fixDuplicatedRefSuffixes(result);
  result = stripPlaceholderFigures(result);
  result = convertTextHighlightsToLatex(result);
  return result;
}
