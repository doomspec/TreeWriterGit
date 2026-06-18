import { useCallback, useEffect, useRef, useState } from "react";

import { EquationBlock } from "@/components/editor/EquationBlock";
import { EquationCard } from "@/components/editor/EquationCard";
import { fetchLatexSource } from "@/lib/equations";
import { saveModelFile } from "@/modelApi";

export function EquationPreviewPanel({
  unitPath,
  refreshVersion,
  liveCaption,
  onModelChanged,
  onError,
}: {
  unitPath: string;
  refreshVersion?: number;
  liveCaption?: string | null;
  onModelChanged?: () => void;
  onError?: (message: string) => void;
}) {
  const sourcePath = `${unitPath}/source.tex`;
  const [source, setSource] = useState("");
  const [loadedSource, setLoadedSource] = useState("");
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchLatexSource(sourcePath)
      .then((text) => {
        if (!cancelled) {
          setSource(text);
          setLoadedSource(text);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          onError?.(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onError, refreshVersion, sourcePath]);

  const scheduleSave = useCallback(
    (nextSource: string) => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        void saveModelFile(sourcePath, nextSource)
          .then(() => {
            setLoadedSource(nextSource);
            onModelChanged?.();
          })
          .catch((err) => {
            onError?.(err instanceof Error ? err.message : String(err));
          });
      }, 800);
    },
    [onError, onModelChanged, sourcePath],
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    },
    [],
  );

  return (
    <div className="max-h-[45vh] shrink-0 overflow-auto border-t border-border bg-card">
      <div className="grid gap-0 lg:grid-cols-2">
        <div className="border-b border-border px-4 py-3 lg:border-b-0 lg:border-r">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            LaTeX source
          </p>
          <textarea
            value={source}
            spellCheck={false}
            aria-label="Edit equation LaTeX source"
            className="min-h-[8rem] w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onChange={(event) => {
              const next = event.target.value;
              setSource(next);
              if (next !== loadedSource) scheduleSave(next);
            }}
          />
        </div>
        <div className="px-4 py-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Preview
          </p>
          <EquationBlock source={source} />
        </div>
      </div>
      <div className="border-t border-border px-4 py-3">
        <EquationCard
          targetPath={unitPath}
          refreshVersion={refreshVersion}
          liveCaption={liveCaption}
          embeddedInEditor
        />
      </div>
    </div>
  );
}
