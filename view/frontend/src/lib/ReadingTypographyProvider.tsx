import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  applyReadingTypography,
  clampReadingFontSizeScale,
  DEFAULT_READING_TYPOGRAPHY,
  loadReadingTypography,
  saveReadingTypography,
  type ReadingFontFamilyId,
  type ReadingTypographySettings,
} from "@/lib/readingTypography";

type ReadingTypographyContextValue = {
  fontFamily: ReadingFontFamilyId;
  fontSizeScale: number;
  setFontFamily: (fontFamily: ReadingFontFamilyId) => void;
  setFontSizeScale: (fontSizeScale: number) => void;
  resetTypography: () => void;
};

const ReadingTypographyContext = createContext<ReadingTypographyContextValue | null>(null);

export function ReadingTypographyProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ReadingTypographySettings>(() => loadReadingTypography());

  useEffect(() => {
    applyReadingTypography(settings);
  }, [settings]);

  const setFontFamily = useCallback((fontFamily: ReadingFontFamilyId) => {
    setSettings((prev) => {
      const next = { ...prev, fontFamily };
      saveReadingTypography(next);
      return next;
    });
  }, []);

  const setFontSizeScale = useCallback((fontSizeScale: number) => {
    setSettings((prev) => {
      const next = { ...prev, fontSizeScale: clampReadingFontSizeScale(fontSizeScale) };
      saveReadingTypography(next);
      return next;
    });
  }, []);

  const resetTypography = useCallback(() => {
    saveReadingTypography(DEFAULT_READING_TYPOGRAPHY);
    setSettings(DEFAULT_READING_TYPOGRAPHY);
  }, []);

  const value = useMemo(
    () => ({
      fontFamily: settings.fontFamily,
      fontSizeScale: settings.fontSizeScale,
      setFontFamily,
      setFontSizeScale,
      resetTypography,
    }),
    [settings.fontFamily, settings.fontSizeScale, setFontFamily, setFontSizeScale, resetTypography],
  );

  return (
    <ReadingTypographyContext.Provider value={value}>{children}</ReadingTypographyContext.Provider>
  );
}

export function useReadingTypography(): ReadingTypographyContextValue {
  const ctx = useContext(ReadingTypographyContext);
  if (!ctx) {
    throw new Error("useReadingTypography must be used within ReadingTypographyProvider");
  }
  return ctx;
}
