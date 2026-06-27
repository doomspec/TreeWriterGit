import { useCallback, useEffect, useState } from "react";

import {
  applyThemePreference,
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/themePreferences";

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => loadThemePreference());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(loadThemePreference()));

  useEffect(() => {
    setResolved(applyThemePreference(preference));
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setResolved(applyThemePreference("system"));
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    saveThemePreference(next);
    setPreferenceState(next);
  }, []);

  const cyclePreference = useCallback(() => {
    setPreferenceState((prev) => {
      const next: ThemePreference =
        prev === "light" ? "dark" : prev === "dark" ? "system" : "light";
      saveThemePreference(next);
      return next;
    });
  }, []);

  return { preference, resolved, setPreference, cyclePreference };
}
