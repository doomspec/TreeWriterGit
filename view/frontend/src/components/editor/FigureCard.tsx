import { useEffect, useState } from "react";
import { ExternalLink, FileImage, FileText } from "lucide-react";

import { MermaidBlock } from "@/components/editor/MermaidBlock";
import { Button } from "@/components/ui/button";
import {
  assetUrl,
  fetchFigureMetadata,
  fetchMermaidSource,
  type FigureMetadata,
} from "@/lib/figures";
import { cn } from "@/lib/utils";
import type { NavigateTarget } from "@/lib/modelTree";

type FigureCardProps = {
  targetPath: string;
  linkContextPath?: string;
  onNavigate?: (target: NavigateTarget) => void;
  className?: string;
};

function FigurePreview({ figure }: { figure: FigureMetadata }) {
  const [mermaidSource, setMermaidSource] = useState<string | null>(null);

  useEffect(() => {
    if (!figure.sourcePath?.endsWith(".mmd")) {
      setMermaidSource(null);
      return;
    }
    if (figure.previewPath && !figure.previewPath.endsWith(".mmd")) return;

    let cancelled = false;
    void fetchMermaidSource(figure.sourcePath)
      .then((source) => {
        if (!cancelled) setMermaidSource(source);
      })
      .catch(() => {
        if (!cancelled) setMermaidSource(null);
      });
    return () => {
      cancelled = true;
    };
  }, [figure.previewPath, figure.sourcePath]);

  if (figure.previewPath) {
    return (
      <img
        src={assetUrl(figure.previewPath)}
        alt={figure.title}
        className="max-h-64 w-full rounded-md border border-border object-contain bg-background"
      />
    );
  }

  if (mermaidSource) {
    return (
      <div className="overflow-x-auto rounded-md border border-border bg-background p-3">
        <MermaidBlock source={mermaidSource} className="mermaid-figure" />
      </div>
    );
  }

  return (
    <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
      No preview available
    </div>
  );
}

export function FigureCard({
  targetPath,
  onNavigate,
  className,
}: FigureCardProps) {
  const [figure, setFigure] = useState<FigureMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMissing(false);
    void fetchFigureMetadata(targetPath)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setMissing(true);
          setFigure(null);
        } else {
          setFigure(data);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setMissing(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [targetPath]);

  if (loading) {
    return (
      <div
        className={cn(
          "my-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground",
          className,
        )}
      >
        Loading figure…
      </div>
    );
  }

  if (missing || !figure) {
    return (
      <div
        className={cn(
          "my-3 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground",
          className,
        )}
      >
        Figure not found: {targetPath}
      </div>
    );
  }

  const openFile = (path: string) => {
    onNavigate?.({ type: "file", path });
  };

  const openFolder = (folderPath: string) => {
    onNavigate?.({ type: "folder", path: folderPath });
  };

  return (
    <figure
      className={cn(
        "my-4 overflow-hidden rounded-md border border-border bg-card shadow-sm",
        className,
      )}
    >
      <div className="border-b border-border bg-muted/20 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Figure
        {figure.figureLabel ? ` · ${figure.figureLabel}` : ""}
      </div>
      <div className="space-y-3 p-3">
        <FigurePreview figure={figure} />
        {figure.caption ? (
          <figcaption className="text-sm leading-relaxed text-foreground">{figure.caption}</figcaption>
        ) : figure.summary ? (
          <figcaption className="text-sm italic text-muted-foreground">{figure.summary}</figcaption>
        ) : null}
        <div className="flex flex-wrap gap-1">
          {figure.outlinePath ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={() => openFile(figure.outlinePath!)}
            >
              <FileText className="h-3 w-3" aria-hidden="true" />
              Outline
            </Button>
          ) : null}
          {figure.draftPath ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={() => openFile(figure.draftPath!)}
            >
              <FileText className="h-3 w-3" aria-hidden="true" />
              Caption
            </Button>
          ) : null}
          {figure.kind === "figure-unit" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={() => openFolder(figure.path)}
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              Open figure
            </Button>
          ) : null}
          {figure.sourcePath ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={() => {
                if (figure.sourcePath!.endsWith(".md") || figure.sourcePath!.endsWith(".mmd")) {
                  openFile(figure.sourcePath!);
                } else {
                  window.open(assetUrl(figure.sourcePath!), "_blank", "noopener,noreferrer");
                }
              }}
            >
              <FileImage className="h-3 w-3" aria-hidden="true" />
              Source
            </Button>
          ) : null}
        </div>
      </div>
    </figure>
  );
}

export function FigureLink({
  href,
  children,
  linkContextPath = "",
  onNavigate,
  linksClickable,
}: {
  href: string;
  children?: React.ReactNode;
  linkContextPath?: string;
  onNavigate?: (target: NavigateTarget) => void;
  linksClickable?: boolean;
}) {
  const [figurePath, setFigurePath] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!href.startsWith("figure://")) {
      setChecked(true);
      return;
    }
    const target = href.slice("figure://".length);
    void fetchFigureMetadata(target)
      .then((meta) => {
        if (cancelled) return;
        setFigurePath(meta ? target : null);
        setChecked(true);
      })
      .catch(() => {
        if (!cancelled) {
          setFigurePath(null);
          setChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [href]);

  if (href.startsWith("figure://") && checked && figurePath) {
    return (
      <FigureCard targetPath={figurePath} linkContextPath={linkContextPath} onNavigate={onNavigate} />
    );
  }

  if (!linksClickable || !onNavigate) {
    return <span className="text-primary">{children}</span>;
  }

  return (
    <a
      href={href.replace(/^figure:\/\//, "")}
      className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      onClick={(event) => {
        event.preventDefault();
        const path = href.startsWith("figure://") ? href.slice("figure://".length) : href;
        onNavigate({ type: "folder", path });
      }}
    >
      {children}
    </a>
  );
}
