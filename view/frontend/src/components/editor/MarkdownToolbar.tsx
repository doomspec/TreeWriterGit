import { useState } from "react";
import {
  Bold,
  ChevronDown,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquarePlus,
  Pilcrow,
  Quote,
  StickyNote,
  Type,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MarkdownFormatAction } from "@/lib/markdownFormat";

type ToolbarItem = {
  action: MarkdownFormatAction | "comment" | "inlineNote";
  label: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  showInRendered?: boolean;
};

const TOOLBAR_ITEMS: ToolbarItem[] = [
  {
    action: "comment",
    label: "Comment",
    title: "Add or view comments (like Overleaf)",
    icon: MessageSquarePlus,
  },
  {
    action: "inlineNote",
    label: "Note",
    title: "Wrap selection in inline note, e.g. \\iy{suggestion}",
    icon: StickyNote,
  },
  {
    action: "link",
    label: "Link",
    title: "Insert link (like Overleaf anchor)",
    icon: Link2,
  },
  { action: "bold", label: "Bold", title: "Bold (Cmd+B)", icon: Bold },
  { action: "italic", label: "Italic", title: "Italic (Cmd+I)", icon: Italic },
  {
    action: "h1",
    label: "H1",
    title: "Heading 1",
    icon: Heading1,
    showInRendered: false,
  },
  {
    action: "h2",
    label: "H2",
    title: "Heading 2 (like Overleaf §)",
    icon: Heading2,
  },
  {
    action: "h3",
    label: "H3",
    title: "Heading 3 (like Overleaf § subsection)",
    icon: Heading3,
  },
  {
    action: "paragraph",
    label: "Paragraph",
    title: "Normal paragraph",
    icon: Pilcrow,
  },
  {
    action: "bulletList",
    label: "Bullet list",
    title: "Bullet list",
    icon: List,
  },
  {
    action: "orderedList",
    label: "Numbered list",
    title: "Numbered list",
    icon: ListOrdered,
  },
  {
    action: "blockquote",
    label: "Quote",
    title: "Blockquote",
    icon: Quote,
  },
];

export function MarkdownToolbar({
  renderedMode = false,
  commentsOpen = false,
  unresolvedComments = 0,
  disabled = false,
  defaultToolsOpen = false,
  onFormat,
  onToggleComments,
  onInsertInlineNote,
}: {
  renderedMode?: boolean;
  commentsOpen?: boolean;
  unresolvedComments?: number;
  disabled?: boolean;
  /** When false, formatting actions stay behind the tools toggle. */
  defaultToolsOpen?: boolean;
  onFormat: (action: MarkdownFormatAction) => void;
  onToggleComments: () => void;
  onInsertInlineNote?: () => void;
}) {
  const [toolsOpen, setToolsOpen] = useState(defaultToolsOpen);

  const visibleItems = TOOLBAR_ITEMS.filter(
    (item) => !renderedMode || item.showInRendered !== false,
  );
  const commentItem = visibleItems.find((item) => item.action === "comment");
  const formatItems = visibleItems.filter((item) => item.action !== "comment");

  const renderItem = (item: ToolbarItem) => {
    if (item.action === "comment") {
      return (
        <Button
          key={item.action}
          type="button"
          variant={commentsOpen ? "default" : "ghost"}
          size="sm"
          className="relative h-7 shrink-0 gap-1 px-2 text-[10px]"
          title={item.title}
          aria-label={item.label}
          aria-pressed={commentsOpen}
          disabled={disabled}
          onClick={onToggleComments}
        >
          <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">{item.label}</span>
          {unresolvedComments > 0 ? (
            <span className="markdown-toolbar__comment-badge absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
              {unresolvedComments > 99 ? "99+" : unresolvedComments}
            </span>
          ) : null}
        </Button>
      );
    }

    if (item.action === "inlineNote") {
      return (
        <Button
          key={item.action}
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 gap-1 px-2 text-[10px]"
          title={item.title}
          aria-label={item.label}
          disabled={disabled || !onInsertInlineNote}
          onClick={() => onInsertInlineNote?.()}
        >
          <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden md:inline">{item.label}</span>
        </Button>
      );
    }

    return (
      <Button
        key={item.action}
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 gap-1 px-2 text-[10px]"
        title={item.title}
        aria-label={item.label}
        disabled={disabled}
        onClick={() => onFormat(item.action as MarkdownFormatAction)}
      >
        <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden md:inline">{item.label}</span>
      </Button>
    );
  };

  return (
    <div className="ui-toolbar markdown-toolbar px-2 py-1" role="toolbar" aria-label="Formatting">
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
        {commentItem ? renderItem(commentItem) : null}
        <Button
          type="button"
          variant={toolsOpen ? "default" : "ghost"}
          size="sm"
          className="h-7 shrink-0 gap-1 px-2 text-[10px]"
          title={toolsOpen ? "Hide formatting tools" : "Show formatting tools"}
          aria-label={toolsOpen ? "Hide formatting tools" : "Show formatting tools"}
          aria-pressed={toolsOpen}
          aria-expanded={toolsOpen}
          disabled={disabled}
          onClick={() => setToolsOpen((open) => !open)}
        >
          <Type className="h-3.5 w-3.5" aria-hidden="true" />
          <ChevronDown
            className={cn(
              "h-3 w-3 text-muted-foreground transition-transform",
              toolsOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </Button>
        {toolsOpen ? formatItems.map(renderItem) : null}
      </div>
    </div>
  );
}

export function authorColorClass(name: string): string {
  const palette = [
    "bg-emerald-500/15 text-emerald-800",
    "bg-sky-500/15 text-sky-800",
    "bg-violet-500/15 text-violet-800",
    "bg-amber-500/15 text-amber-900",
    "bg-rose-500/15 text-rose-800",
    "bg-teal-500/15 text-teal-800",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i) * (i + 1)) % palette.length;
  }
  return palette[hash] ?? palette[0];
}

export function authorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
