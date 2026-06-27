export type DocxImportUnit = {
  title: string;
  body: string;
};

export type DocxImportSection = {
  title: string;
  units: DocxImportUnit[];
};

export type ParsedDocxMarkdown = {
  paperTitle?: string;
  sections: DocxImportSection[];
};

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

function splitParagraphUnits(text: string): DocxImportUnit[] {
  const blocks = text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !HEADING_RE.test(part));

  return blocks.map((body, index) => ({
    title: body.split(/\n/)[0]?.slice(0, 80) || `unit-${index + 1}`,
    body,
  }));
}

/** Split pandoc markdown into TreeWriter sections (##) and units (### or paragraphs). */
export function parseMarkdownImportStructure(markdown: string): ParsedDocxMarkdown {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return { sections: [] };
  }

  let paperTitle: string | undefined;
  const sections: DocxImportSection[] = [];
  let currentSection: DocxImportSection | null = null;
  let currentUnitTitle: string | undefined;
  let currentUnitLines: string[] = [];
  let sectionBodyLines: string[] = [];

  const flushUnit = () => {
    if (!currentSection) return;
    const body = currentUnitLines.join("\n").trim();
    if (!body && !currentUnitTitle) return;
    const title = currentUnitTitle ?? body.split(/\n/)[0]?.slice(0, 80) ?? "unit";
    currentSection.units.push({ title, body: body || title });
    currentUnitTitle = undefined;
    currentUnitLines = [];
  };

  const flushSection = () => {
    if (!currentSection) return;
    flushUnit();
    if (currentSection.units.length === 0) {
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
        currentSection = { title, units: [] };
        sections.push(currentSection);
        continue;
      }
      if (level === 3 && currentSection) {
        flushUnit();
        currentUnitTitle = title;
        continue;
      }
    }

    if (currentUnitTitle !== undefined || currentUnitLines.length > 0) {
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
      currentSection = { title: "Body", units: [] };
      sections.push(currentSection);
      sectionBodyLines.push(line);
    }
  }

  flushSection();

  return {
    paperTitle,
    sections: sections.filter((section) => section.units.length > 0),
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
