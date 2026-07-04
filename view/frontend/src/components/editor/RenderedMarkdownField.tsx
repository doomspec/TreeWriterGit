import { ProseMirrorMarkdownField } from "@/components/editor/ProseMirrorMarkdownField";
import type { BlockMarkdownEditorHandle } from "@/components/editor/editorHandle";
import { cn } from "@/lib/utils";
import type { NavigateTarget } from "@/lib/modelTree";

/** Edit markdown as rendered prose (ProseMirror). */
export function RenderedMarkdownField({
  value,
  onChange,
  onSelect,
  className,
  placeholder = "Write here…",
  ariaLabel,
  linkContextPath = "",
  linksClickable = false,
  onNavigate,
  refreshVersion = 0,
  editorRef,
  approvedBaseline = "",
  highlightPending = false,
  onActiveFormatsChange,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect?: () => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  linkContextPath?: string;
  linksClickable?: boolean;
  onNavigate?: (target: NavigateTarget) => void;
  refreshVersion?: number;
  editorRef?: React.RefObject<BlockMarkdownEditorHandle | null>;
  approvedBaseline?: string;
  highlightPending?: boolean;
  onActiveFormatsChange?: (actions: string[]) => void;
}) {
  return (
    <div className={cn("rendered-markdown-field w-full", className)}>
      <ProseMirrorMarkdownField
        editorRef={editorRef}
        value={value}
        onChange={onChange}
        onSelect={onSelect}
        ariaLabel={ariaLabel}
        placeholder={placeholder}
        onNavigate={onNavigate}
        linkContextPath={linkContextPath}
        linksClickable={linksClickable}
        onActiveFormatsChange={onActiveFormatsChange}
        approvedBaseline={approvedBaseline}
        showPendingDiff={highlightPending}
        refreshVersion={refreshVersion}
      />
    </div>
  );
}
