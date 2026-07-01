import { createContext, useContext, type ReactNode } from "react";

import { useBibLibrarySummary as useBibLibrarySummaryStore } from "@/lib/bibLibraryStore";
import type { MainBibSummary } from "@/lib/paperAssets";

type BibLibraryContextValue = {
  summary: MainBibSummary | null;
  loading: boolean;
  reload: () => Promise<void>;
};

const BibLibraryContext = createContext<BibLibraryContextValue | null>(null);

export function BibLibraryProvider({ children }: { children: ReactNode }) {
  const value = useBibLibrarySummaryStore();
  return <BibLibraryContext.Provider value={value}>{children}</BibLibraryContext.Provider>;
}

export function useBibLibrarySummary(): BibLibraryContextValue {
  const context = useContext(BibLibraryContext);
  if (context) return context;
  return useBibLibrarySummaryStore();
}
