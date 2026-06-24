import { memo, useCallback, useEffect, useRef, useState } from "react";
import { FileImage, Upload } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { MermaidBlock } from "@/components/editor/MermaidBlock";
import { Button } from "@/components/ui/button";
import {
  assetUrl,
  fetchFigureMetadata,
  fetchMermaidSource,
  FIGURE_IMAGE_ACCEPT,
  isFigureUploadFile,
  uploadFigureImage,
  type FigureMetadata,
} from "@/lib/figures";
import { cn } from "@/lib/utils";
import type { NavigateTarget } from "@/lib/modelTree";

type FigureCardProps = {
  targetPath: string;
  refreshVersion?: number;
  liveCaption?: string | null;
  embeddedInEditor?: boolean;
  linkContextPath?: string;
  linksClickable?: boolean;
  onNavigate?: (target: NavigateTarget) => void;
  onModelChanged?: () => void;
  onError?: (message: string) => void;
  className?: string;
};

function FigureCaption({ markdown, live = false }: { markdown: string; live?: boolean }) {
  if (live) {
    return (
      <div className="figure-caption-markdown whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {markdown}
      </div>
    );
  }
  return (
    <div className="figure-caption-markdown text-sm leading-relaxed text-foreground [&>p]:m-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}

const FigurePreview = memo(function FigurePreview({
  figure,
  imageVersion = 0,
  onUploadClick,
  uploading,
  embeddedInEditor = false,
}: {
  figure: FigureMetadata;
  imageVersion?: number;
  onUploadClick?: () => void;
  uploading?: boolean;
  embeddedInEditor?: boolean;
}) {
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
    const src =
      imageVersion > 0
        ? `${assetUrl(figure.previewPath)}&_v=${imageVersion}`
        : assetUrl(figure.previewPath);
    const mediaClass = embeddedInEditor
      ? "max-h-full min-h-[10rem] w-full rounded-md border border-border bg-background"
      : "max-h-64 w-full rounded-md border border-border object-contain bg-background";
    if (figure.previewPath.toLowerCase().endsWith(".pdf")) {
      return (
        <iframe
          src={src}
          title={figure.title}
          className={cn(mediaClass, embeddedInEditor ? "h-full" : "h-64")}
        />
      );
    }
    return (
      <img
        src={src}
        alt={figure.title}
        className={cn(mediaClass, "object-contain")}
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
      {onUploadClick ? (
        <div className="flex flex-col items-center gap-2">
          <span>No preview yet</span>
          <span className="text-[10px] text-muted-foreground/80">
            Drag an image or PDF here, or use the button below
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[10px]"
            disabled={uploading}
            onClick={onUploadClick}
          >
            <Upload className="h-3 w-3" aria-hidden="true" />
            {uploading ? "Uploading…" : "Upload image"}
          </Button>
        </div>
      ) : (
        "No preview available"
      )}
    </div>
  );
});

function FigureDropZone({
  enabled,
  uploading,
  dragOver,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  children,
}: {
  enabled: boolean;
  uploading: boolean;
  dragOver: boolean;
  onDragEnter: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  children: React.ReactNode;
}) {
  if (!enabled) return <>{children}</>;

  return (
    <div
      className={cn(
        "relative rounded-md transition-colors",
        dragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}
      {dragOver ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary/10 px-4 text-center text-xs font-medium text-primary"
          aria-hidden="true"
        >
          {uploading ? "Uploading…" : "Drop image or PDF to upload"}
        </div>
      ) : null}
    </div>
  );
}

export function FigureCard({
  targetPath,
  refreshVersion = 0,
  liveCaption,
  embeddedInEditor = false,
  onNavigate,
  onModelChanged,
  onError,
  className,
}: FigureCardProps) {
  const [figure, setFigure] = useState<FigureMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const canUpload = Boolean(onModelChanged || onError);

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
  }, [targetPath, refreshVersion]);

  const handleUploadClick = () => fileInputRef.current?.click();

  const uploadFile = useCallback(
    async (file: File) => {
      if (!isFigureUploadFile(file)) {
        onError?.("Unsupported file type. Use PNG, JPEG, SVG, GIF, WebP, or PDF.");
        return;
      }
      setUploading(true);
      try {
        const updated = await uploadFigureImage(targetPath, file);
        setFigure(updated);
        setImageVersion((v) => v + 1);
        setMissing(false);
        onModelChanged?.();
      } catch (err) {
        onError?.(err instanceof Error ? err.message : String(err));
      } finally {
        setUploading(false);
      }
    },
    [onError, onModelChanged, targetPath],
  );

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await uploadFile(file);
  };

  const resetDragState = () => {
    dragDepthRef.current = 0;
    setDragOver(false);
  };

  const handleDragEnter = (event: React.DragEvent) => {
    if (!canUpload || uploading) return;
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    if (!canUpload || uploading) return;
    event.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      resetDragState();
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (!canUpload || uploading) return;
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (event: React.DragEvent) => {
    if (!canUpload || uploading) return;
    event.preventDefault();
    resetDragState();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    void uploadFile(file);
  };

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

  const displayCaption =
    liveCaption !== null && liveCaption !== undefined ? liveCaption : figure.caption;
  const captionIsLive = liveCaption !== null && liveCaption !== undefined;
  const showSummary = !displayCaption && figure.summary;

  return (
    <figure
      className={cn(
        embeddedInEditor
          ? "my-0 overflow-hidden rounded-md border border-border bg-card shadow-sm"
          : "my-4 overflow-hidden rounded-md border border-border bg-card shadow-sm",
        className,
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={FIGURE_IMAGE_ACCEPT}
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
      />
      <div className="border-b border-border bg-muted/20 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Figure
        {figure.figureLabel ? ` · ${figure.figureLabel}` : ""}
      </div>
      <div className="space-y-3 p-3">
        <FigureDropZone
          enabled={canUpload}
          uploading={uploading}
          dragOver={dragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <FigurePreview
            figure={figure}
            imageVersion={imageVersion}
            uploading={uploading}
            embeddedInEditor={embeddedInEditor}
            onUploadClick={canUpload ? handleUploadClick : undefined}
          />
        </FigureDropZone>
        {displayCaption ? (
          <figcaption className="text-sm leading-relaxed text-foreground">
            <FigureCaption markdown={displayCaption} live={captionIsLive} />
          </figcaption>
        ) : showSummary ? (
          <figcaption className="text-sm italic text-muted-foreground">{figure.summary}</figcaption>
        ) : null}
        <div className="flex flex-wrap gap-1">
          {canUpload ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              disabled={uploading}
              onClick={handleUploadClick}
            >
              <Upload className="h-3 w-3" aria-hidden="true" />
              {uploading ? "Uploading…" : figure.previewPath ? "Replace file" : "Upload image or PDF"}
            </Button>
          ) : null}
          {!embeddedInEditor && figure.sourcePath ? (
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
