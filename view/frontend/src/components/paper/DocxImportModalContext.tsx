import { createContext, useCallback, useContext, useEffect, useMemo, useState, type RefObject } from "react";

import { DocxImportModal } from "@/components/paper/DocxImportModal";

type DocxImportModalContextValue = {
  openDocxImport: () => void;
};

const DocxImportModalContext = createContext<DocxImportModalContextValue>({
  openDocxImport: () => {},
});

export function DocxImportModalProvider({
  paperSlug,
  paperPath,
  browsePath,
  activeFile,
  onError,
  onComplete,
  openRef,
  children,
}: {
  paperSlug: string | null;
  paperPath?: string | null;
  browsePath?: string | null;
  activeFile?: string | null;
  onError: (message: string) => void;
  onComplete?: () => void;
  openRef?: RefObject<(() => void) | undefined>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const openDocxImport = useCallback(() => {
    if (!paperSlug) return;
    setOpen(true);
  }, [paperSlug]);

  useEffect(() => {
    if (!openRef) return;
    openRef.current = openDocxImport;
    return () => {
      openRef.current = undefined;
    };
  }, [openDocxImport, openRef]);

  const value = useMemo(() => ({ openDocxImport }), [openDocxImport]);

  return (
    <DocxImportModalContext.Provider value={value}>
      {children}
      {paperSlug ? (
        <DocxImportModal
          open={open}
          paperSlug={paperSlug}
          paperPath={paperPath}
          browsePath={browsePath}
          activeFile={activeFile}
          onClose={() => setOpen(false)}
          onError={onError}
          onComplete={onComplete}
        />
      ) : null}
    </DocxImportModalContext.Provider>
  );
}

export function useDocxImportModal(): DocxImportModalContextValue {
  return useContext(DocxImportModalContext);
}
