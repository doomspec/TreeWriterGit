import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyTheme,
  isThemePreference,
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
  systemPrefersDark,
} from "./themePreferences";

describe("themePreferences", () => {
  const classList = new Set<string>();

  beforeEach(() => {
    classList.clear();
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    });
    vi.stubGlobal("document", {
      documentElement: {
        classList: {
          toggle: (name: string, force?: boolean) => {
            if (force === undefined) {
              if (classList.has(name)) classList.delete(name);
              else classList.add(name);
              return;
            }
            if (force) classList.add(name);
            else classList.delete(name);
          },
          contains: (name: string) => classList.has(name),
          remove: (name: string) => {
            classList.delete(name);
          },
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates theme preference values", () => {
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("auto")).toBe(false);
  });

  it("loads and saves preference", () => {
    saveThemePreference("dark");
    expect(loadThemePreference()).toBe("dark");
  });

  it("defaults to system when unset", () => {
    expect(loadThemePreference()).toBe("system");
  });

  it("resolves system from matchMedia", () => {
    vi.stubGlobal(
      "window",
      {
        matchMedia: vi.fn().mockImplementation((query: string) => ({
          matches: query.includes("dark"),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      },
    );
    expect(resolveTheme("system")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("applyTheme toggles dark class on html", () => {
    applyTheme("dark");
    expect(classList.has("dark")).toBe(true);
    applyTheme("light");
    expect(classList.has("dark")).toBe(false);
  });

  it("systemPrefersDark reads matchMedia", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    expect(systemPrefersDark()).toBe(true);
  });
});
