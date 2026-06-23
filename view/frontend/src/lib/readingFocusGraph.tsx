import { createContext, useContext } from "react";

import { GraphPanel } from "@/components/graph/GraphPanel";
import type { GraphScope } from "@/lib/graphLocal";
import { useReadingFocus } from "@/lib/readingFocus";

export type ReadingFocusGraphConfig = {
  fetchRoot: string;
  focusPath: string;
  graphScope: GraphScope;
  refreshVersion: number;
  onGraphScopeChange: (scope: GraphScope) => void;
  onSelectNode: (id: string) => void;
};

const ReadingFocusGraphContext = createContext<ReadingFocusGraphConfig | null>(null);

export function ReadingFocusGraphProvider({
  config,
  children,
}: {
  config: ReadingFocusGraphConfig | null;
  children: React.ReactNode;
}) {
  return (
    <ReadingFocusGraphContext.Provider value={config}>{children}</ReadingFocusGraphContext.Provider>
  );
}

export function useReadingFocusGraph(): ReadingFocusGraphConfig | null {
  return useContext(ReadingFocusGraphContext);
}

export function ReadingFocusInlineGraph() {
  const { active } = useReadingFocus();
  const graph = useReadingFocusGraph();

  if (!active || !graph?.fetchRoot) return null;

  return (
    <div className="reading-focus-inline-graph" role="img" aria-label="Link graph">
      <GraphPanel
        embedded
        minimal
        active
        fetchRoot={graph.fetchRoot}
        focusPath={graph.focusPath}
        graphScope={graph.graphScope}
        refreshVersion={graph.refreshVersion}
        onGraphScopeChange={graph.onGraphScopeChange}
        onSelectNode={(id) => {
          if (id.startsWith("missing:")) return;
          graph.onSelectNode(id);
        }}
      />
    </div>
  );
}
