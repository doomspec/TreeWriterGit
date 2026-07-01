import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bold,
  Check,
  Code,
  ChevronDown,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  MessageSquarePlus,
  Pilcrow,
  Quote,
  StickyNote,
  Strikethrough,
  Subscript,
  Superscript,
  Type,
} from "lucide-react";

import { AssetInsertMenu } from "@/components/editor/AssetInsertMenu";
import { HighlightToolbarButton } from "@/components/editor/HighlightToolbarButton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MarkdownFormatAction } from "@/lib/markdownFormat";
import type { TextHighlightColorId } from "@/lib/textHighlight";

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
  { action: "strikethrough", label: "Strikethrough", title: "Strikethrough", icon: Strikethrough },
  { action: "subscript", label: "Subscript", title: "Subscript (e.g. H~2~O)", icon: Subscript },
  { action: "superscript", label: "Superscript", title: "Superscript (e.g. x^2^)", icon: Superscript },
  { action: "code", label: "Inline code", title: "Inline code", icon: Code },
  { action: "codeBlock", label: "Code block", title: "Code block", icon: FileCode },
  {
    action: "h1",
    label: "Heading 1",
    title: "Heading 1",
    icon: Heading1,
    showInRendered: false,
  },
  {
    action: "h2",
    label: "Heading 2",
    title: "Heading 2 (like Overleaf §)",
    icon: Heading2,
  },
  {
    action: "h3",
    label: "Heading 3",
    title: "Heading 3 (like Overleaf § subsection)",
    icon: Heading3,
  },
  {
    action: "paragraph",
    label: "Normal paragraph",
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
    action: "taskList",
    label: "Task list",
    title: "Task list (- [ ] item)",
    icon: ListTodo,
  },
  {
    action: "blockquote",
    label: "Blockquote",
    title: "Blockquote",
    icon: Quote,
  },
];

function FormatToolsPopover({
  items,
  disabled,
  onFormat,
  embedded,
  activeActions,
}: {
  items: ToolbarItem[];
  disabled?: boolean;
  onFormat: (action: MarkdownFormatAction) => void;
  embedded?: boolean;
  activeActions?: ReadonlySet<string>;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const update = () => {
      const button = buttonRef.current;
      const menu = menuRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const menuWidth = menu?.offsetWidth ?? 180;
      setPosition({
        top: rect.bottom + 6,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant={open ? "default" : "ghost"}
        size="sm"
        className="h-7 shrink-0 gap-1 px-2 text-[10px]"
        title="Formatting tools"
        aria-label="Formatting tools"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <Type className="h-3.5 w-3.5" aria-hidden="true" />
        {!embedded ? <span className="hidden sm:inline">Format</span> : null}
        <ChevronDown
          className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </Button>
      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              data-editor-floating-chrome
              className="fixed z-overlay w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
              style={{ top: position.top, left: position.left }}
            >
              {items.map((item) => {
                const active = activeActions?.has(item.action) ?? false;
                return (
                  <button
                    key={item.action}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={active}
                    disabled={disabled}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50",
                      active && "bg-accent/60 font-medium text-accent-foreground",
                    )}
                    onClick={() => {
                      onFormat(item.action as MarkdownFormatAction);
                      setOpen(false);
                    }}
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    {active ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function ToolbarIconButton({
  item,
  disabled,
  pressed,
  onClick,
}: {
  item: ToolbarItem;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={pressed ? "default" : "ghost"}
      size="sm"
      className="h-7 w-7 shrink-0 px-0"
      title={item.title}
      aria-label={item.label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
    </Button>
  );
}

export function MarkdownToolbar({
  renderedMode = false,
  commentsOpen = false,
  unresolvedComments = 0,
  disabled = false,
  embedded = false,
  inline = false,
  paperPath = null,
  filePath = "",
  refreshVersion = 0,
  onFormat,
  onToggleComments,
  onInsertInlineNote,
  onInsertHighlight,
  onInsertSnippet,
  activeActions,
}: {
  renderedMode?: boolean;
  commentsOpen?: boolean;
  unresolvedComments?: number;
  disabled?: boolean;
  embedded?: boolean;
  /** Compact icon-only layout for the floating inline selection toolbar. */
  inline?: boolean;
  paperPath?: string | null;
  filePath?: string;
  refreshVersion?: number;
  onFormat: (action: MarkdownFormatAction) => void;
  onToggleComments: () => void;
  onInsertInlineNote?: () => void;
  onInsertHighlight?: (color: TextHighlightColorId) => void;
  onInsertSnippet?: (snippet: string) => void;
  /** Format actions active at the caret/selection (PM surface). Highlights toolbar items. */
  activeActions?: ReadonlySet<string>;
}) {
  const visibleItems = TOOLBAR_ITEMS.filter(
    (item) => !renderedMode || item.showInRendered !== false,
  );
  const commentItem = visibleItems.find((item) => item.action === "comment");
  const formatItems = visibleItems.filter(
    (item) => item.action !== "comment" && item.action !== "inlineNote",
  );
  const noteItem = visibleItems.find((item) => item.action === "inlineNote");
  const quickFormatItems = formatItems.filter((item) =>
    ["bold", "italic", "link"].includes(item.action),
  );
  const overflowFormatItems = formatItems.filter(
    (item) => !["bold", "italic", "link"].includes(item.action),
  );

  return (
    <div
      className={cn(
        embedded ? "markdown-toolbar min-w-0" : "ui-toolbar markdown-toolbar px-2 py-1",
        inline && "markdown-toolbar--inline",
      )}
      role="toolbar"
      aria-label="Formatting"
      onMouseDown={(event) => {
        if (event.target instanceof Element && event.target.closest("button")) {
          event.preventDefault();
        }
      }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-0.5">
        {commentItem ? (
          <Button
            type="button"
            variant={commentsOpen ? "default" : "ghost"}
            size="sm"
            className={cn(
              "relative h-7 shrink-0 gap-1 text-[10px]",
              inline ? "w-7 px-0" : "px-2",
            )}
            title={commentItem.title}
            aria-label={commentItem.label}
            aria-pressed={commentsOpen}
            disabled={disabled}
            onClick={onToggleComments}
          >
            <commentItem.icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{commentItem.label}</span>
            {unresolvedComments > 0 ? (
              <span className="markdown-toolbar__comment-badge absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                {unresolvedComments > 99 ? "99+" : unresolvedComments}
              </span>
            ) : null}
          </Button>
        ) : null}
        {paperPath && onInsertSnippet ? (
          <AssetInsertMenu
            paperPath={paperPath}
            filePath={filePath}
            refreshVersion={refreshVersion}
            disabled={disabled}
            embedded={embedded}
            inline={inline}
            onInsert={onInsertSnippet}
          />
        ) : null}
        {noteItem && !embedded && !inline ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-[10px]"
            title={noteItem.title}
            aria-label={noteItem.label}
            disabled={disabled || !onInsertInlineNote}
            onClick={() => onInsertInlineNote?.()}
          >
            <noteItem.icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden md:inline">{noteItem.label}</span>
          </Button>
        ) : null}
        {inline
          ? quickFormatItems.map((item) => (
              <ToolbarIconButton
                key={item.action}
                item={item}
                disabled={disabled}
                pressed={activeActions?.has(item.action)}
                onClick={() => onFormat(item.action as MarkdownFormatAction)}
              />
            ))
          : null}
        <HighlightToolbarButton disabled={disabled} onInsertHighlight={onInsertHighlight} />
        {noteItem && inline ? (
          <ToolbarIconButton
            item={noteItem}
            disabled={disabled || !onInsertInlineNote}
            onClick={() => onInsertInlineNote?.()}
          />
        ) : null}
        <FormatToolsPopover
          items={inline ? overflowFormatItems : formatItems}
          disabled={disabled}
          embedded={embedded || inline}
          onFormat={onFormat}
          activeActions={activeActions}
        />
      </div>
    </div>
  );
}

export function authorColorClass(name: string): string {
  const palette = [
    "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
    "bg-sky-500/15 text-sky-800 dark:text-sky-300",
    "bg-violet-500/15 text-violet-800 dark:text-violet-300",
    "bg-amber-500/15 text-amber-900 dark:text-amber-200",
    "bg-rose-500/15 text-rose-800 dark:text-rose-300",
    "bg-teal-500/15 text-teal-800 dark:text-teal-300",
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
