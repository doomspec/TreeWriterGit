export type ReadingFontFamilyId =
  | "georgia"
  | "crimson"
  | "palatino"
  | "charter"
  | "atkinson"
  | "system";

export type ReadingTypographySettings = {
  fontFamily: ReadingFontFamilyId;
  fontSizeScale: number;
};

export const READING_FONT_FAMILIES: Record<
  ReadingFontFamilyId,
  { label: string; stack: string }
> = {
  georgia: {
    label: "Georgia",
    stack: 'Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, serif',
  },
  crimson: {
    label: "Crimson Pro",
    stack: '"Crimson Pro", Georgia, "Palatino Linotype", Palatino, serif',
  },
  palatino: {
    label: "Palatino",
    stack: '"Palatino Linotype", Palatino, Georgia, serif',
  },
  charter: {
    label: "Charter",
    stack: 'Charter, "Bitstream Charter", Georgia, serif',
  },
  atkinson: {
    label: "Atkinson Hyperlegible",
    stack: '"Atkinson Hyperlegible", system-ui, sans-serif',
  },
  system: {
    label: "System serif",
    stack: 'ui-serif, Georgia, "Times New Roman", serif',
  },
};

export const READING_FONT_SIZE_MIN = 0.85;
export const READING_FONT_SIZE_MAX = 1.35;
export const READING_FONT_SIZE_DEFAULT = 1;
export const READING_FONT_SIZE_STEP = 0.05;

const STORAGE_KEY = "treewriter.readingTypography.v1";
const VALID_FAMILIES = Object.keys(READING_FONT_FAMILIES) as ReadingFontFamilyId[];

export const DEFAULT_READING_TYPOGRAPHY: ReadingTypographySettings = {
  fontFamily: "georgia",
  fontSizeScale: READING_FONT_SIZE_DEFAULT,
};

export function isReadingFontFamilyId(value: unknown): value is ReadingFontFamilyId {
  return typeof value === "string" && VALID_FAMILIES.includes(value as ReadingFontFamilyId);
}

export function clampReadingFontSizeScale(value: number): number {
  return Math.min(
    READING_FONT_SIZE_MAX,
    Math.max(READING_FONT_SIZE_MIN, Math.round(value * 100) / 100),
  );
}

export function loadReadingTypography(): ReadingTypographySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_READING_TYPOGRAPHY;
    const parsed = JSON.parse(raw) as Partial<ReadingTypographySettings>;
    return {
      fontFamily: isReadingFontFamilyId(parsed.fontFamily)
        ? parsed.fontFamily
        : DEFAULT_READING_TYPOGRAPHY.fontFamily,
      fontSizeScale: clampReadingFontSizeScale(
        typeof parsed.fontSizeScale === "number"
          ? parsed.fontSizeScale
          : DEFAULT_READING_TYPOGRAPHY.fontSizeScale,
      ),
    };
  } catch {
    return DEFAULT_READING_TYPOGRAPHY;
  }
}

export function saveReadingTypography(settings: ReadingTypographySettings): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        fontFamily: settings.fontFamily,
        fontSizeScale: clampReadingFontSizeScale(settings.fontSizeScale),
      }),
    );
  } catch {
    // quota or private mode
  }
}

export function readingFontFamilyStack(id: ReadingFontFamilyId): string {
  return READING_FONT_FAMILIES[id]?.stack ?? READING_FONT_FAMILIES.georgia.stack;
}

export function formatReadingFontSizeScale(scale: number): string {
  return `${Math.round(clampReadingFontSizeScale(scale) * 100)}%`;
}

export function applyReadingTypography(settings: ReadingTypographySettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--reading-font-family", readingFontFamilyStack(settings.fontFamily));
  root.style.setProperty(
    "--reading-font-size-scale",
    String(clampReadingFontSizeScale(settings.fontSizeScale)),
  );
}
