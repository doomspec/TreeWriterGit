import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { FigureCard, FigureLink } from "@/components/editor/FigureCard";
import { EquationCard, EquationLink } from "@/components/editor/EquationCard";
import { LatexLabelBadge } from "@/components/editor/LatexLabelBadge";
import { LatexRefBadge } from "@/components/editor/LatexRefBadge";
import { InlineNoteBadge } from "@/components/editor/InlineNoteBadge";
import { TextHighlightBadge } from "@/components/editor/TextHighlightBadge";
import { MermaidBlock } from "@/components/editor/MermaidBlock";
import { resolveAssetSrc } from "@/lib/figures";
import { parseInlineNoteCodeSpan, preprocessInlineNotesForMarkdown } from "@/lib/inlineNotes";
import { parseTextHighlightCodeSpan, preprocessTextHighlightsForMarkdown } from "@/lib/textHighlight";
import { preprocessLatexForMarkdownPreview } from "@/lib/latexPreview";
import { parseLabelCodeSpan, parseRefCodeSpan, preprocessLatexTokensForMarkdown } from "@/lib/latexTokens";
import {
  EQUATION_BLOCK_LANG,
  FIGURE_BLOCK_LANG,
  preprocessMarkdownLinks,
  resolveNavigateTarget,
  type NavigateTarget,
} from "@/lib/modelTree";
import { cn } from "@/lib/utils";

export function MarkdownViewer({
  markdown,
  className,
  linkContextPath = "",
  onNavigate,
  linksClickable = false,
}: {
  markdown: string;
  className?: string;
  linkContextPath?: string;
  onNavigate?: (target: NavigateTarget) => void;
  linksClickable?: boolean;
}) {
  const processed = useMemo(
    () =>
      preprocessInlineNotesForMarkdown(
        preprocessTextHighlightsForMarkdown(
          preprocessLatexTokensForMarkdown(
            preprocessLatexForMarkdownPreview(preprocessMarkdownLinks(markdown)),
          ),
        ),
      ),
    [markdown],
  );

  const components = useMemo(
    () => ({
      code: ({
        children,
        className: codeClassName,
      }: {
        children?: React.ReactNode;
        className?: string;
      }) => {
        const raw = String(children ?? "").replace(/\n$/, "");
        if (codeClassName === `language-${FIGURE_BLOCK_LANG}`) {
          return (
            <FigureCard
              targetPath={raw.trim()}
              linkContextPath={linkContextPath}
              onNavigate={onNavigate}
            />
          );
        }
        if (codeClassName === `language-${EQUATION_BLOCK_LANG}`) {
          return (
            <EquationCard
              targetPath={raw.trim()}
              linkContextPath={linkContextPath}
              onNavigate={onNavigate}
            />
          );
        }
        if (codeClassName === "language-mermaid") {
          return <MermaidBlock source={raw} className="my-4 overflow-x-auto" />;
        }
        const labelKey = !codeClassName ? parseLabelCodeSpan(raw) : null;
        if (labelKey) {
          return <LatexLabelBadge labelKey={labelKey} />;
        }
        const refKey = !codeClassName ? parseRefCodeSpan(raw) : null;
        if (refKey) {
          return <LatexRefBadge refKey={refKey} />;
        }
        const highlight = !codeClassName ? parseTextHighlightCodeSpan(raw) : null;
        if (highlight) {
          return <TextHighlightBadge color={highlight.color} text={highlight.text} />;
        }
        const note = !codeClassName ? parseInlineNoteCodeSpan(raw) : null;
        if (note) {
          return <InlineNoteBadge author={note.author} text={note.text} />;
        }
        return <code className={codeClassName}>{children}</code>;
      },
      pre: ({
        children,
      }: {
        children?: React.ReactNode;
      }) => {
        return <pre>{children}</pre>;
      },
      img: ({
        src,
        alt,
      }: {
        src?: string;
        alt?: string;
      }) => {
        if (!src) return null;
        const resolved = resolveAssetSrc(src, linkContextPath);
        return (
          <img
            src={resolved}
            alt={alt ?? ""}
            className="my-3 max-h-96 w-full rounded-md border border-border object-contain"
          />
        );
      },
      a: ({
        href,
        children,
      }: {
        href?: string;
        children?: React.ReactNode;
      }) => {
        if (!href) return <span>{children}</span>;

        if (href.startsWith("http://") || href.startsWith("https://")) {
          return (
            <a href={href} target="_blank" rel="noreferrer noopener" className="text-primary underline">
              {children}
            </a>
          );
        }

        if (href.startsWith("figure://")) {
          return (
            <FigureLink
              href={href}
              linkContextPath={linkContextPath}
              onNavigate={onNavigate}
              linksClickable={linksClickable}
            >
              {children}
            </FigureLink>
          );
        }

        if (href.startsWith("equation://")) {
          return (
            <EquationLink
              href={href}
              linkContextPath={linkContextPath}
              onNavigate={onNavigate}
              linksClickable={linksClickable}
            >
              {children}
            </EquationLink>
          );
        }

        if (linksClickable && onNavigate && linkContextPath !== undefined) {
          const target = resolveNavigateTarget(linkContextPath, href);
          if (target) {
            return (
              <a
                href={href}
                className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(target);
                }}
              >
                {children}
              </a>
            );
          }
        }

        return <span className="text-primary">{children}</span>;
      },
    }),
    [linkContextPath, linksClickable, onNavigate],
  );

  if (!markdown.trim()) {
    return null;
  }

  return (
    <div className={cn("markdown-body markdown-reading", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {processed}
      </ReactMarkdown>
    </div>
  );
}
