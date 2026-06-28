export type DocxImportUnit = {
  title: string;
  body: string;
};

export type DocxImportSubsection = {
  title: string;
  units: DocxImportUnit[];
};

export type DocxImportSection = {
  title: string;
  units: DocxImportUnit[];
  subsections: DocxImportSubsection[];
};

export type ParsedDocxMarkdown = {
  paperTitle?: string;
  sections: DocxImportSection[];
};

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

/** Infer markdown heading depth from Word-style numbered titles. */
export function inferHeadingLevelFromTitle(title: string): number {
  const trimmed = title.trim();
  const numberedPrefix = trimmed.match(/^(\d+\.)+/);
  if (numberedPrefix) {
    const depth = numberedPrefix[0].split(".").filter(Boolean).length;
    return Math.min(depth + 1, 6);
  }
  return 3;
}

/** Pandoc often emits Word Heading styles as standalone `**Title**` lines. */
export function normalizePandocMarkdownHeadings(markdown: string): string {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/^\*\*(.+?)\*\*\s*$/gm, (_line, title: string) => {
      const trimmed = title.trim();
      if (/^ADD\s*\(/i.test(trimmed)) {
        return `**${trimmed}**`;
      }
      const level = inferHeadingLevelFromTitle(title);
      return `${"#".repeat(level)} ${trimmed}`;
    });
}

function unitTitleFromBody(body: string, fallback: string): string {
  const firstLine = body.split(/\n/)[0]?.trim() ?? "";
  const stripped = firstLine.replace(/^\*\*(.+?)\*\*$/, "$1").trim();
  const candidate = stripped.slice(0, 80);
  return candidate || fallback;
}

/** Split block text into one unit per blank-line-separated paragraph. */
export function splitMarkdownParagraphUnits(text: string, firstTitle?: string): DocxImportUnit[] {
  const blocks = text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !HEADING_RE.test(part));

  if (blocks.length === 0) {
    if (firstTitle) {
      return [{ title: firstTitle, body: firstTitle }];
    }
    return [];
  }

  return blocks.map((body, index) => ({
    title:
      index === 0 && firstTitle
        ? firstTitle
        : unitTitleFromBody(body, `unit-${index + 1}`),
    body,
  }));
}

function splitParagraphUnits(text: string): DocxImportUnit[] {
  return splitMarkdownParagraphUnits(text);
}

function emptySection(title: string): DocxImportSection {
  return { title, units: [], subsections: [] };
}

function sectionHasContent(section: DocxImportSection): boolean {
  return section.units.length > 0 || section.subsections.length > 0;
}

/** Split pandoc markdown into TreeWriter sections (##), subsections (###), and units. */
export function parseMarkdownImportStructure(markdown: string): ParsedDocxMarkdown {
  const normalized = normalizePandocMarkdownHeadings(markdown).trim();
  if (!normalized) {
    return { sections: [] };
  }

  let paperTitle: string | undefined;
  const sections: DocxImportSection[] = [];
  let currentSection: DocxImportSection | null = null;
  let currentSubsection: DocxImportSubsection | null = null;
  let currentUnitTitle: string | undefined;
  let currentUnitLines: string[] = [];
  let sectionBodyLines: string[] = [];

  const flushUnit = () => {
    if (!currentSection) return;
    const body = currentUnitLines.join("\n").trim();
    if (!body && !currentUnitTitle) return;
    const units = splitMarkdownParagraphUnits(body, currentUnitTitle);
    const targetUnits =
      units.length === 0 && currentUnitTitle
        ? [{ title: currentUnitTitle, body: currentUnitTitle }]
        : units;
    if (currentSubsection) {
      currentSubsection.units.push(...targetUnits);
    } else {
      currentSection.units.push(...targetUnits);
    }
    currentUnitTitle = undefined;
    currentUnitLines = [];
  };

  const flushSubsection = () => {
    if (!currentSection || !currentSubsection) return;
    if (currentSubsection.units.length > 0) {
      currentSection.subsections.push(currentSubsection);
    }
    currentSubsection = null;
  };

  const flushSection = () => {
    if (!currentSection) return;
    flushUnit();
    flushSubsection();
    if (currentSection.units.length === 0 && currentSection.subsections.length === 0) {
      currentSection.units = splitParagraphUnits(sectionBodyLines.join("\n"));
    }
    sectionBodyLines = [];
    currentSection = null;
  };

  for (const line of normalized.split("\n")) {
    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].trim();
      if (level === 1 && !paperTitle) {
        paperTitle = title;
        continue;
      }
      if (level === 2) {
        flushSection();
        currentSection = emptySection(title);
        sections.push(currentSection);
        continue;
      }
      if (level === 3 && currentSection) {
        flushUnit();
        flushSubsection();
        currentSubsection = { title, units: [] };
        continue;
      }
      if (level >= 4 && currentSection) {
        flushUnit();
        currentUnitTitle = title;
        continue;
      }
    }

    if (currentUnitTitle !== undefined || currentUnitLines.length > 0 || currentSubsection) {
      currentUnitLines.push(line);
      continue;
    }

    if (currentSection) {
      if (line.trim() || sectionBodyLines.length > 0) {
        sectionBodyLines.push(line);
      }
      continue;
    }

    if (line.trim()) {
      currentSection = emptySection("Body");
      sections.push(currentSection);
      sectionBodyLines.push(line);
    }
  }

  flushSection();

  return {
    paperTitle,
    sections: sections.filter(sectionHasContent),
  };
}

export function slugFromImportTitle(title: string): string {
  const normalized = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || "item";
}

export function uniqueImportSlug(base: string, used: Set<string>): string {
  const root = slugFromImportTitle(base);
  let candidate = root;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}
