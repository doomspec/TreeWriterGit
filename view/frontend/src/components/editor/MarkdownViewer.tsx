import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

export function MarkdownViewer({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  if (!markdown.trim()) {
    return null;
  }

  return (
    <div className={cn("markdown-body markdown-reading", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
