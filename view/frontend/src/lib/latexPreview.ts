import katex from "katex";

export type LatexPreviewMathMode = "markdown" | "html";

const INLINE_MATH_MARKDOWN: Record<string, string> = {
  "\\to": "→",
  "p<0.001": "*p* < 0.001",
  "d_z=2.16": "*d*~z~ = 2.16",
};

const katexHtmlCache = new Map<string, string>();

function renderKatexHtml(math: string): string {
  const cached = katexHtmlCache.get(math);
  if (cached !== undefined) return cached;

  try {
    const html = katex.renderToString(math, {
      throwOnError: false,
      displayMode: false,
      strict: "ignore",
    });
    katexHtmlCache.set(math, html);
    return html;
  } catch {
    return math;
  }
}

function micrometerMarkdown(trimmed: string): string | null {
  const withQty = trimmed.match(/^([\d.]+)~?\\mu\\text\{m\}$/);
  if (withQty) return `${withQty[1]} µm`;
  if (trimmed === "\\mu\\text{m}") return "µm";
  return null;
}

function microliterMarkdown(trimmed: string): string | null {
  const withQty = trimmed.match(/^([\d.]+)~?\\mu\\text\{L\}$/);
  if (withQty) return `${withQty[1]} µL`;
  if (trimmed === "\\mu\\text{L}") return "µL";
  return null;
}

function convertInlineMath(math: string, mode: LatexPreviewMathMode): string {
  const trimmed = math.trim();
  if (!trimmed) return "";

  if (mode === "markdown") {
    const mapped = INLINE_MATH_MARKDOWN[trimmed];
    if (mapped) return mapped;
    const microMeter = micrometerMarkdown(trimmed);
    if (microMeter) return microMeter;
    const microLiter = microliterMarkdown(trimmed);
    if (microLiter) return microLiter;
    return `\`${trimmed.replace(/`/g, "'")}\``;
  }

  const microMeter = micrometerMarkdown(trimmed);
  if (microMeter) return renderKatexHtml(trimmed);
  const microLiter = microliterMarkdown(trimmed);
  if (microLiter) return renderKatexHtml(trimmed);

  return renderKatexHtml(trimmed);
}

/** Authors often close math before the unit letter, e.g. `$0.1 µ$L` or `10 $µ$L`. */
function fixPrematureMicroLiterDelimiter(text: string): string {
  return text.replace(
    /(\d+(?:\.\d+)?\s+)?\$([^$\n]*?)(?:µ|μ|\\mu)\$L\b/g,
    (_, prefix: string | undefined, beforeMicro: string) => {
      let qty = `${prefix ?? ""}${beforeMicro}`.trimEnd();
      qty = qty.replace(/~$/, "");
      return qty ? `$${qty}~\\mu\\text{L}$` : "$\\mu\\text{L}$";
    },
  );
}

/** Fix `$µ$m` / `200 $µ$m` / `$30 µ$m` where math closes before the trailing unit letter. */
function fixSplitMicroUnits(text: string): string {
  return text
    .replace(/(\d+(?:\.\d+)?\s+)?\$(?:µ|μ)\$m\b/g, (_, prefix: string | undefined) => {
      const qty = (prefix ?? "").trimEnd().replace(/~$/, "");
      return qty ? `$${qty}~\\mu\\text{m}$` : "$\\mu\\text{m}$";
    })
    .replace(/(\d+(?:\.\d+)?\s+)?\$(?:µ|μ)\$L\b/g, (_, prefix: string | undefined) => {
      const qty = (prefix ?? "").trimEnd().replace(/~$/, "");
      return qty ? `$${qty}~\\mu\\text{L}$` : "$\\mu\\text{L}$";
    })
    .replace(/\$([\d.]+)\s*(?:µ|μ)\$m\b/g, (_, qty: string) => `$${qty}~\\mu\\text{m}$`)
    .replace(/\$([\d.]+)\s*(?:µ|μ)\$L\b/g, (_, qty: string) => `$${qty}~\\mu\\text{L}$`);
}

/** Map remaining unicode micro signs inside math to KaTeX-safe forms. */
function normalizeMathContent(inner: string): string {
  return inner
    .replace(/([\d.]+)\s*(?:µ|μ)(?=\s*$)/g, "$1~\\mu")
    .replace(/(?:µ|μ)(?=m\b)/g, "\\mu\\text{m}")
    .replace(/(?:µ|μ)(?=L\b)/g, "\\mu\\text{L}")
    .replace(/(?:µ|μ)/g, "\\mu");
}

/** Escape characters that would break markdown emphasis wrappers. */
function escapeMarkdownEmphasisContent(inner: string, wrapper: "**" | "*"): string {
  let escaped = inner.replace(/\\/g, "\\\\");
  escaped = escaped.replace(/\*/g, "\\*");
  if (wrapper === "*") {
    escaped = escaped.replace(/_/g, "\\_");
  }
  return escaped;
}

function latexBoldToMarkdown(inner: string): string {
  return `**${escapeMarkdownEmphasisContent(inner, "**")}**`;
}

function latexItalicToMarkdown(inner: string): string {
  return `*${escapeMarkdownEmphasisContent(inner, "*")}*`;
}

/** Turn common LaTeX planning markup in outlines into markdown/HTML the preview can render. */
export function preprocessLatexForMarkdownPreview(
  markdown: string,
  options: { math?: LatexPreviewMathMode } = {},
): string {
  const mathMode = options.math ?? "markdown";
  let text = markdown;

  text = text.replace(/\\textbf\{([^}]*)\}/g, (_, inner: string) => latexBoldToMarkdown(inner));
  text = text.replace(/\\textit\{([^}]*)\}/g, (_, inner: string) => latexItalicToMarkdown(inner));
  text = text.replace(/\\emph\{([^}]*)\}/g, (_, inner: string) => latexItalicToMarkdown(inner));
  text = text.replace(/Fig\.~/g, "Fig.\u00a0");
  text = text.replace(/(\d)~([a-zA-Z])/g, "$1\u00a0$2");
  text = fixPrematureMicroLiterDelimiter(text);
  text = fixSplitMicroUnits(text);
  text = text.replace(/\$([^$\n]+)\$/g, (_, math: string) =>
    convertInlineMath(normalizeMathContent(math), mathMode),
  );

  return text;
}

/** @internal test helper */
export function clearLatexPreviewCache(): void {
  katexHtmlCache.clear();
}
