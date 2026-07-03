import { useEffect, useRef, useState } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { indentWithTab, redo, undo } from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { Redo2, Save, Search, Undo2 } from "lucide-react";

import { fetchModelFile, saveModelFile } from "@/modelApi";
import { useIsDarkMode } from "@/lib/useIsDarkMode";
import { cn } from "@/lib/utils";

const AUTOSAVE_DEBOUNCE_MS = 800;

function basename(path: string): string {
  return path.split("/").pop() || path;
}

/**
 * IDE-style editor for a single project-root file of any text type. Loads
 * content from the model API, edits with CodeMirror (syntax highlight by
 * extension, lazily loaded), and autosaves on a debounce.
 */
export function CodeFileEditor({
  path,
  onError,
  onSavingChange,
}: {
  path: string;
  onError?: (message: string) => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());
  const langCompartment = useRef(new Compartment());
  const saveTimerRef = useRef<number | undefined>(undefined);
  // Latest doc text pending save, kept in a ref so the debounce flush and the
  // unmount cleanup always persist what the user actually typed.
  const pendingRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  // Set to the current effect's flushSave so toolbar/keyboard save can trigger it.
  const flushRef = useRef<() => void>(() => {});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const isDark = useIsDarkMode();

  const themeExtension = isDark ? oneDark : [];

  // Build (or rebuild) the editor whenever the open file changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDirty(false);
    pendingRef.current = null;

    const flushSave = () => {
      if (saveTimerRef.current !== undefined) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = undefined;
      }
      const content = pendingRef.current;
      if (content == null) return;
      pendingRef.current = null;
      savingRef.current = true;
      onSavingChange?.(true);
      void saveModelFile(path, content)
        .catch((err) => onError?.(err instanceof Error ? err.message : String(err)))
        .finally(() => {
          savingRef.current = false;
          onSavingChange?.(false);
          if (!cancelled) setDirty(false);
        });
    };

    const scheduleSave = (content: string) => {
      pendingRef.current = content;
      if (!cancelled) setDirty(true);
      if (saveTimerRef.current !== undefined) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(flushSave, AUTOSAVE_DEBOUNCE_MS);
    };
    flushRef.current = flushSave;

    void (async () => {
      let content = "";
      try {
        content = (await fetchModelFile(path)).content;
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        onError?.(message);
        setLoading(false);
        return;
      }
      if (cancelled || !hostRef.current) return;

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) scheduleSave(update.state.doc.toString());
      });

      const view = new EditorView({
        parent: hostRef.current,
        state: EditorState.create({
          doc: content,
          extensions: [
            basicSetup,
            keymap.of([
              indentWithTab,
              {
                key: "Mod-s",
                preventDefault: true,
                run: () => {
                  flushSave();
                  return true;
                },
              },
            ]),
            langCompartment.current.of([]),
            themeCompartment.current.of(themeExtension),
            EditorView.lineWrapping,
            updateListener,
          ],
        }),
      });
      viewRef.current = view;
      setLoading(false);

      // Lazy-load the language grammar for this filename, if any.
      const description = LanguageDescription.matchFilename(languages, basename(path));
      if (description) {
        try {
          const support = await description.load();
          if (!cancelled && viewRef.current === view) {
            view.dispatch({ effects: langCompartment.current.reconfigure(support) });
          }
        } catch {
          // No grammar is fine — plain text editing still works.
        }
      }
    })();

    return () => {
      cancelled = true;
      // Persist any buffered edits synchronously-ish before tearing down.
      if (saveTimerRef.current !== undefined) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = undefined;
      }
      const content = pendingRef.current;
      if (content != null) {
        pendingRef.current = null;
        void saveModelFile(path, content).catch(() => {});
      }
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // themeExtension intentionally excluded: theme changes are applied via the
    // compartment effect below without rebuilding the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Reconfigure theme in place when dark mode toggles.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: themeCompartment.current.reconfigure(themeExtension) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  const runOnView = (command: (view: EditorView) => boolean) => {
    const view = viewRef.current;
    if (!view) return;
    command(view);
    view.focus();
  };

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-2 py-1">
        <ToolbarButton label="Undo (Mod+Z)" onClick={() => runOnView(undo)} disabled={!!error}>
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Redo (Mod+Shift+Z)" onClick={() => runOnView(redo)} disabled={!!error}>
          <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        <ToolbarButton label="Find (Mod+F)" onClick={() => runOnView(openSearchPanel)} disabled={!!error}>
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Save (Mod+S)" onClick={() => flushRef.current()} disabled={!!error}>
          <Save className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        <span className="ml-2 min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={path}>
          {path}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {dirty ? "Unsaved…" : "Saved"}
        </span>
      </div>
      {error ? (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <div className="relative min-h-0 min-w-0 flex-1">
          <div
            ref={hostRef}
            className={cn(
              "absolute inset-0 overflow-auto text-[13px]",
              loading && "opacity-0",
            )}
          />
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Loading…
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}
