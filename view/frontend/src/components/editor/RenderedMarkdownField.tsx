import { BlockMarkdownEditor, type BlockMarkdownEditorHandle } from "@/components/editor/BlockMarkdownEditor";
import { cn } from "@/lib/utils";
import type { FigureMetadata } from "@/lib/figures";
import type { NavigateTarget } from "@/lib/modelTree";
import type { DraftPendingSource } from "@/lib/draftApproval";

type PendingApprovalProps = {
  pendingSource: DraftPendingSource | null;
  editedBy?: string | null;
  aiAssisted?: boolean;
  aiProvider?: string | null;
  loadedContent: string;
  onApprove: () => void;
  onDiscard: () => void;
  approving?: boolean;
  approveLabel?: string;
};

/** Edit markdown as rendered prose — block-level read/edit toggle. */
export function RenderedMarkdownField({
  value,
  onChange,
  onSelect,
  onBlur,
  onKeyDown,
  onTextareaSync,
  className,
  placeholder = "Write here…",
  ariaLabel,
  linkContextPath = "",
  linksClickable = false,
  onNavigate,
  refreshVersion = 0,
  inputRef,
  editorRef,
  activeOutlineNavPath = null,
  showPreview: _showPreview = true,
  approvedBaseline = "",
  loadedContent = "",
  highlightPending = false,
  figureLabelIndex,
  pendingApproval = null,
  compact: _compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect?: () => void;
  onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;
  onTextareaSync?: (textarea: HTMLTextAreaElement) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  linkContextPath?: string;
  linksClickable?: boolean;
  onNavigate?: (target: NavigateTarget) => void;
  refreshVersion?: number;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  editorRef?: React.RefObject<BlockMarkdownEditorHandle | null>;
  activeOutlineNavPath?: string | null;
  showPreview?: boolean;
  approvedBaseline?: string;
  loadedContent?: string;
  highlightPending?: boolean;
  figureLabelIndex?: Map<string, FigureMetadata>;
  pendingApproval?: PendingApprovalProps | null;
  compact?: boolean;
}) {
  return (
    <div className={cn("rendered-markdown-field w-full", className)}>
      <BlockMarkdownEditor
        ref={editorRef}
        value={value}
        approvedBaseline={approvedBaseline}
        loadedContent={loadedContent}
        highlightPending={highlightPending}
        figureLabelIndex={figureLabelIndex}
        pendingApproval={pendingApproval}
        onChange={onChange}
        onSelect={onSelect}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onTextareaSync={onTextareaSync}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        linkContextPath={linkContextPath}
        linksClickable={linksClickable}
        onNavigate={onNavigate}
        refreshVersion={refreshVersion}
        activeOutlineNavPath={activeOutlineNavPath}
        inputRef={inputRef}
      />
    </div>
  );
}
