import { normalizeTextHighlightMacros } from "@/lib/textHighlight";

/** Repair macro syntax corrupted by contenteditable HTML roundtrips. */
export function repairEditorMacroSyntax(markdown: string): string {
  let result = markdown;

  while (/\\\\(?:ref|label|hl|mu)\{/.test(result)) {
    result = result.replace(/\\\\(ref|label|hl)\{/g, "\\$1{");
  }
  result = result.replace(/\\\\mu\\text/g, "\\mu\\text");

  // Bare ⟦hl:color:text⟧ tokens (partially round-tripped highlights).
  result = result.replace(
    /(\w+)`\s*⟦hl:([a-z]+):([\s\S]*?)⟧\s*`?/g,
    (_full, word: string, color: string, text: string) => {
      return `${word} \\hl{${color}}{${text.trim()}}`;
    },
  );
  result = result.replace(/`?\s*⟦hl:([a-z]+):([\s\S]*?)⟧\s*`?/g, (_full, color: string, text: string) => {
    return `\\hl{${color}}{${text.trim()}}`;
  });

  // Stray backticks around \hl{…} macros (creates grey <code> boxes in preview).
  result = result.replace(/`(\s*\\hl\{[a-z]+\}\{[^}]*\}\s*)`/g, "$1");
  result = result.replace(/(\w+)`(\s*\\hl\{[a-z]+\}\{[^}]*\})/g, "$1 $2");
  result = result.replace(/(\\hl\{[a-z]+\}\{[^}]*\})`(\w+)/g, "$1 $2");

  // Broken encoded ref tokens: `§ref:key§`suffix or \`§ref:key§\`suffix
  result = result.replace(/\\?`?§ref:([^`§]+)§\\?`?([a-zA-Z0-9_:]*)/g, (_full, key: string) => {
    return `\\ref{${key.replace(/\\_/g, "_")}}`;
  });

  // Duplicated ref suffix: \ref{fig:system}fig:systemA → \ref{fig:system}
  result = result.replace(/\\ref\{([^}]+)\}([a-zA-Z0-9_:]+)/g, (full, key: string, trailing: string) => {
    const normalizedKey = key.replace(/\\_/g, "_");
    const normalizedTrailing = trailing.replace(/\\_/g, "_");
    if (normalizedTrailing === normalizedKey || normalizedTrailing.startsWith(normalizedKey)) {
      return `\\ref{${key}}`;
    }
    return full;
  });

  // Bare \mu\text{L/m} outside math delimiters.
  result = result.replace(/([\d.]+)~?\\mu\\text\{L\}/g, "$1 µL");
  result = result.replace(/([\d.]+)~?\\mu\\text\{m\}/g, "$1 µm");

  // Collapse consecutive identical figure embed lines (double-insert accident).
  result = result.replace(/(::figure\[[^\]]+\]\s*\n\s*){2,}/g, (block) => {
    const first = block.trim().split("\n").find((line) => line.startsWith("::figure["));
    return first ? `${first}\n\n` : block;
  });

  return normalizeTextHighlightMacros(result);
}
