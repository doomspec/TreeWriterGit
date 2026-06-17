import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { InlineNoteBadge } from "@/components/editor/InlineNoteBadge";
import { cn } from "@/lib/utils";
import { parseInlineNoteCodeSpan, preprocessInlineNotesForMarkdown } from "@/lib/inlineNotes";
import {
  preprocessMarkdownLinks,
  resolveNavigateTarget,
  type NavigateTarget,
} from "@/lib/modelTree";

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
    () => preprocessInlineNotesForMarkdown(preprocessMarkdownLinks(markdown)),
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
        const note = !codeClassName ? parseInlineNoteCodeSpan(raw) : null;
        if (note) {
          return <InlineNoteBadge author={note.author} text={note.text} />;
        }
        return (
          <code className={codeClassName}>
            {children}
          </code>
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
