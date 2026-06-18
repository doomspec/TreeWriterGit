import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { EquationBlock } from "@/components/editor/EquationBlock";
import { fetchEquationMetadata, fetchLatexSource, type EquationMetadata } from "@/lib/equations";
import { cn } from "@/lib/utils";
import type { NavigateTarget } from "@/lib/modelTree";

type EquationCardProps = {
  targetPath: string;
  refreshVersion?: number;
  liveCaption?: string | null;
  embeddedInEditor?: boolean;
  linkContextPath?: string;
  onNavigate?: (target: NavigateTarget) => void;
  className?: string;
};

function EquationCaption({ markdown }: { markdown: string }) {
  return (
    <div className="equation-caption-markdown text-sm leading-relaxed text-foreground [&>p]:m-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}

export function EquationCard({
  targetPath,
  refreshVersion = 0,
  liveCaption,
  embeddedInEditor = false,
  className,
}: EquationCardProps) {
  const [equation, setEquation] = useState<EquationMetadata | null>(null);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMissing(false);
    void fetchEquationMetadata(targetPath)
      .then(async (data) => {
        if (cancelled) return;
        if (!data) {
          setMissing(true);
          setEquation(null);
          setSource("");
          setLoading(false);
          return;
        }
        setEquation(data);
        if (data.sourcePath) {
          const latex = await fetchLatexSource(data.sourcePath);
          if (!cancelled) setSource(latex);
        } else if (!cancelled) {
          setSource("");
        }
        if (!cancelled) setLoading(false);
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

  if (loading) {
    return (
      <div
        className={cn(
          "my-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground",
          className,
        )}
      >
        Loading equation…
      </div>
    );
  }

  if (missing || !equation) {
    return (
      <div
        className={cn(
          "my-3 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground",
          className,
        )}
      >
        Equation not found: {targetPath}
      </div>
    );
  }

  const displayCaption =
    liveCaption !== null && liveCaption !== undefined ? liveCaption : equation.caption;
  const showSummary = !displayCaption && equation.summary;

  return (
    <figure
      className={cn(
        "my-4 overflow-hidden rounded-md border border-border bg-card shadow-sm",
        embeddedInEditor && "my-0 border-0 shadow-none",
        className,
      )}
    >
      {!embeddedInEditor ? (
        <div className="border-b border-border bg-muted/20 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Equation
          {equation.equationLabel ? ` · ${equation.equationLabel}` : ""}
        </div>
      ) : null}
      <div className="space-y-3 p-3">
        {!embeddedInEditor ? <EquationBlock source={source} /> : null}
        {displayCaption ? (
          <figcaption className="text-sm leading-relaxed text-foreground">
            <EquationCaption markdown={displayCaption} />
          </figcaption>
        ) : showSummary ? (
          <figcaption className="text-sm italic text-muted-foreground">{equation.summary}</figcaption>
        ) : null}
      </div>
    </figure>
  );
}

export function EquationLink({
  href,
  children,
  onNavigate,
  linksClickable,
}: {
  href: string;
  children?: React.ReactNode;
  linkContextPath?: string;
  onNavigate?: (target: NavigateTarget) => void;
  linksClickable?: boolean;
}) {
  const [equationPath, setEquationPath] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!href.startsWith("equation://")) {
      setChecked(true);
      return;
    }
    const target = href.slice("equation://".length);
    void fetchEquationMetadata(target)
      .then((meta) => {
        if (cancelled) return;
        setEquationPath(meta ? target : null);
        setChecked(true);
      })
      .catch(() => {
        if (!cancelled) {
          setEquationPath(null);
          setChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [href]);

  if (href.startsWith("equation://") && checked && equationPath) {
    return <EquationCard targetPath={equationPath} onNavigate={onNavigate} />;
  }

  if (!linksClickable || !onNavigate) {
    return <span className="text-primary">{children}</span>;
  }

  return (
    <a
      href={href.replace(/^equation:\/\//, "")}
      className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      onClick={(event) => {
        event.preventDefault();
        const path = href.startsWith("equation://") ? href.slice("equation://".length) : href;
        onNavigate({ type: "folder", path });
      }}
    >
      {children}
    </a>
  );
}
