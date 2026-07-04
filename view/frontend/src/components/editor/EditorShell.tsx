import type { ReactNode } from "react";

import { CommentsPanel } from "@/components/editor/CommentsPanel";
import { AssetAutocompletePopup } from "@/components/editor/AssetAutocompletePopup";
import type { useAssetAutocomplete } from "@/lib/useAssetAutocomplete";

type AssetAutocompleteState = ReturnType<typeof useAssetAutocomplete>;

export function EditorCommentsOverlay({
  open,
  filePath,
  paneLabel,
  refreshVersion,
  selectedLine,
  overlay = false,
  onClose,
  onError,
  onUnresolvedChange,
  onCommentsChange,
  onNavigateToLine,
}: {
  open: boolean;
  filePath: string;
  paneLabel?: string;
  refreshVersion: number;
  selectedLine: number;
  overlay?: boolean;
  onClose: () => void;
  onError?: (message: string) => void;
  onUnresolvedChange: (count: number) => void;
  onCommentsChange?: (comments: import("@/modelApi").CommentRecord[]) => void;
  onNavigateToLine?: (line: number) => void;
}) {
  if (!open) return null;
  return (
    <>
      {overlay ? (
        <button
          type="button"
          className="absolute inset-0 z-10 bg-overlay/40 backdrop-blur-[1px]"
          aria-label="Close comments"
          onClick={onClose}
        />
      ) : null}
      <CommentsPanel
        filePath={filePath}
        paneLabel={paneLabel}
        refreshVersion={refreshVersion}
        selectedLine={selectedLine}
        overlay={overlay}
        onError={onError}
        onClose={onClose}
        onUnresolvedChange={onUnresolvedChange}
        onCommentsChange={onCommentsChange}
        onNavigateToLine={onNavigateToLine}
      />
    </>
  );
}

export function EditorAssetAutocompleteLayer({
  autocomplete,
  onApplyValue,
}: {
  autocomplete: AssetAutocompleteState;
  onApplyValue: (value: string) => void;
}) {
  return (
    <AssetAutocompletePopup
      open={autocomplete.state.open}
      top={autocomplete.state.position?.top ?? null}
      left={autocomplete.state.position?.left ?? null}
      items={autocomplete.state.items}
      selectedIndex={autocomplete.state.selectedIndex}
      selectedCiteKeys={autocomplete.state.selectedCiteKeys}
      attachedCiteKeys={autocomplete.attachedCiteKeys}
      isCiteMode={autocomplete.isCiteMode}
      loading={autocomplete.state.loading}
      commandLabel={autocomplete.commandLabel}
      onClose={autocomplete.close}
      onHighlightIndex={autocomplete.highlightIndex}
      onToggleCiteKey={autocomplete.toggleSelectedCiteKey}
      onPopupInteractionStart={autocomplete.beginPopupInteraction}
      onPopupInteractionEnd={autocomplete.endPopupInteraction}
      onPick={(item) => {
        autocomplete.applyItem(null, item, onApplyValue);
      }}
    />
  );
}

/** Shared editor chrome wrapper — comments overlay + autocomplete slot. */
export function EditorShell({
  className,
  children,
  comments,
  autocomplete,
}: {
  className?: string;
  children: ReactNode;
  comments?: ReactNode;
  autocomplete?: ReactNode;
}) {
  return (
    <div className={className}>
      {children}
      {comments}
      {autocomplete}
    </div>
  );
}
