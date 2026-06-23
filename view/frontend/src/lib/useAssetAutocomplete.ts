import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import {
  appendReferenceCompletion,
  applyAssetCompletion,
  applyReferenceCompletion,
  assetCommandLabel,
  buildAssetCompletions,
  detectAssetTrigger,
  finishReferenceCompletion,
  pendingCiteKeysFromTrigger,
  shouldKeepAutocompleteOpen,
  shouldResetAutocompleteSelection,
  type AssetCompletionItem,
  type AssetTrigger,
} from "@/lib/assetAutocomplete";
import { normalizeCiteKeys } from "@/lib/assetInsert";
import { fetchPaperAssets, type PaperAssetsBundle, type ReferenceMetadata } from "@/lib/paperAssets";
import {
  ensureReferenceIndex,
  invalidateReferenceSearchCache,
} from "@/lib/referenceSearchCache";
import { getTextareaCaretRect } from "@/lib/textareaCaret";

type AutocompleteState = {
  open: boolean;
  trigger: ReturnType<typeof detectAssetTrigger>;
  items: AssetCompletionItem[];
  selectedIndex: number;
  selectedCiteKeys: string[];
  position: { top: number; left: number } | null;
  loading: boolean;
};

const closedState: AutocompleteState = {
  open: false,
  trigger: null,
  items: [],
  selectedIndex: 0,
  selectedCiteKeys: [],
  position: null,
  loading: false,
};

function citeKeysToInsert(
  items: AssetCompletionItem[],
  selectedIndex: number,
  selectedCiteKeys: string[],
): string[] {
  const current = items[selectedIndex]?.citeKey;
  if (selectedCiteKeys.length > 0) {
    return normalizeCiteKeys(current ? [...selectedCiteKeys, current] : selectedCiteKeys);
  }
  return current ? [current] : [];
}

export function useAssetAutocomplete({
  paperPath,
  filePath,
  refreshVersion,
  enabled = true,
}: {
  paperPath: string | null | undefined;
  filePath: string;
  refreshVersion: number;
  enabled?: boolean;
}) {
  const assetsRef = useRef<PaperAssetsBundle | null>(null);
  const referencesRef = useRef<ReferenceMetadata[] | null>(null);
  const loadingAssetsRef = useRef(false);
  const loadingReferencesRef = useRef(false);
  const lastTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const activeTriggerRef = useRef<AssetTrigger | null>(null);
  const popupInteractingRef = useRef(false);
  const [state, setState] = useState<AutocompleteState>(closedState);

  activeTriggerRef.current = state.trigger;

  const loadAssets = useCallback(async () => {
    if (!paperPath || loadingAssetsRef.current) return assetsRef.current;
    loadingAssetsRef.current = true;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      assetsRef.current = await fetchPaperAssets(paperPath);
      return assetsRef.current;
    } catch {
      assetsRef.current = null;
      return null;
    } finally {
      loadingAssetsRef.current = false;
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [paperPath]);

  const loadReferences = useCallback(async () => {
    if (!paperPath || loadingReferencesRef.current) return referencesRef.current;
    loadingReferencesRef.current = true;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      referencesRef.current = await ensureReferenceIndex(paperPath);
      return referencesRef.current;
    } catch {
      referencesRef.current = null;
      return null;
    } finally {
      loadingReferencesRef.current = false;
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [paperPath]);

  useEffect(() => {
    assetsRef.current = null;
    referencesRef.current = null;
    if (paperPath) invalidateReferenceSearchCache(paperPath);
  }, [paperPath, refreshVersion]);

  const close = useCallback(() => {
    activeTriggerRef.current = null;
    popupInteractingRef.current = false;
    setState(closedState);
  }, []);

  const beginPopupInteraction = useCallback(() => {
    popupInteractingRef.current = true;
  }, []);

  const endPopupInteraction = useCallback(() => {
    popupInteractingRef.current = false;
  }, []);

  const refreshOpenState = useCallback(
    (
      textarea: HTMLTextAreaElement,
      trigger: AssetTrigger,
      prevTrigger: AssetTrigger | null,
      prevSelectedIndex: number,
      prevSelectedCiteKeys: string[],
      references: ReferenceMetadata[],
    ) => {
      const assets = assetsRef.current;
      const items = assets ? buildAssetCompletions(assets, trigger, filePath, references) : [];
      const resetSelection = shouldResetAutocompleteSelection(prevTrigger, trigger);
      const maxIndex = Math.max(0, items.length - 1);
      const selectedIndex = resetSelection
        ? 0
        : Math.min(Math.max(0, prevSelectedIndex), maxIndex);
      const nextState: AutocompleteState = {
        open: true,
        trigger,
        items,
        selectedIndex,
        selectedCiteKeys: resetSelection ? [] : prevSelectedCiteKeys,
        position: getTextareaCaretRect(textarea, trigger.end),
        loading: false,
      };
      activeTriggerRef.current = trigger;
      setState(nextState);
      return nextState;
    },
    [filePath],
  );

  const applyEditorChange = useCallback(
    (
      textarea: HTMLTextAreaElement,
      value: string,
      cursor: number,
      onApply: (value: string, cursor: number) => void,
    ) => {
      lastTextareaRef.current = textarea;
      flushSync(() => onApply(value, cursor));
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    },
    [],
  );

  const sync = useCallback(
    async (textarea: HTMLTextAreaElement, cursorOverride?: number) => {
      lastTextareaRef.current = textarea;
      if (!enabled || !paperPath) {
        close();
        return;
      }

      const selection = textarea.selectionStart;
      const active = activeTriggerRef.current;

      if (
        active &&
        cursorOverride === undefined &&
        !popupInteractingRef.current &&
        !shouldKeepAutocompleteOpen(textarea.value, selection, active)
      ) {
        close();
        return;
      }

      const cursor = cursorOverride ?? selection;
      const trigger = detectAssetTrigger(textarea.value, cursor);
      if (!trigger) {
        close();
        return;
      }

      let references = referencesRef.current ?? [];
      if (trigger.kind === "cite" && references.length === 0) {
        references = (await loadReferences()) ?? [];
      }

      let assets = assetsRef.current;
      if (trigger.kind !== "cite" && !assets) {
        assets = (await loadAssets()) ?? null;
        if (!assets) {
          activeTriggerRef.current = trigger;
          setState({
            open: true,
            trigger,
            items: [],
            selectedIndex: 0,
            selectedCiteKeys: [],
            position: getTextareaCaretRect(textarea, trigger.end),
            loading: loadingAssetsRef.current,
          });
          return;
        }
      }

      const bundle: PaperAssetsBundle =
        assets ??
        ({
          figures: [],
          tables: [],
          equations: [],
          referenceCount: references.length,
        } satisfies PaperAssetsBundle);

      setState((prev) => {
        const items = buildAssetCompletions(bundle, trigger, filePath, references);
        const resetSelection = shouldResetAutocompleteSelection(prev.trigger, trigger);
        const maxIndex = Math.max(0, items.length - 1);
        const selectedIndex = resetSelection
          ? 0
          : Math.min(Math.max(0, prev.selectedIndex), maxIndex);
        activeTriggerRef.current = trigger;
        return {
          open: true,
          trigger,
          items,
          selectedIndex,
          selectedCiteKeys: resetSelection ? [] : prev.selectedCiteKeys,
          position: getTextareaCaretRect(textarea, trigger.end),
          loading: loadingAssetsRef.current || loadingReferencesRef.current,
        };
      });
    },
    [close, enabled, filePath, loadAssets, loadReferences, paperPath],
  );

  const handleEditorBlur = useCallback(
    (_textarea: HTMLTextAreaElement) => {
      requestAnimationFrame(() => {
        if (popupInteractingRef.current) return;
        const active = document.activeElement;
        if (active instanceof HTMLElement && active.closest(".asset-autocomplete")) return;
        if (!activeTriggerRef.current) return;
        close();
      });
    },
    [close],
  );

  const finalizeCite = useCallback(
    (
      textarea: HTMLTextAreaElement,
      onApply: (value: string, cursor: number) => void,
    ) => {
      const trigger = state.trigger ?? activeTriggerRef.current;
      if (!trigger || trigger.kind !== "cite") return;
      const result = finishReferenceCompletion(textarea.value, trigger);
      applyEditorChange(textarea, result.value, result.cursor, onApply);
      close();
    },
    [applyEditorChange, close, state.trigger],
  );

  const finalizeCiteKeys = useCallback(
    (
      textarea: HTMLTextAreaElement,
      citeKeys: string[],
      onApply: (value: string, cursor: number) => void,
    ) => {
      const trigger = state.trigger ?? activeTriggerRef.current;
      if (!trigger || trigger.kind !== "cite" || citeKeys.length === 0) return;
      const pending = pendingCiteKeysFromTrigger(trigger);
      const result = applyReferenceCompletion(textarea.value, trigger, [...pending, ...citeKeys]);
      applyEditorChange(textarea, result.value, result.cursor, onApply);
      close();
    },
    [applyEditorChange, close, state.trigger],
  );

  const continueCite = useCallback(
    (
      textarea: HTMLTextAreaElement,
      citeKey: string,
      onApply: (value: string, cursor: number) => void,
    ) => {
      const trigger = state.trigger ?? activeTriggerRef.current;
      if (!trigger || trigger.kind !== "cite") return;
      const result = appendReferenceCompletion(textarea.value, trigger, citeKey);
      applyEditorChange(textarea, result.value, result.cursor, onApply);

      const nextTrigger = detectAssetTrigger(result.value, result.cursor);
      if (!nextTrigger) {
        close();
        return;
      }

      const references = referencesRef.current ?? [];
      if (references.length > 0) {
        refreshOpenState(textarea, nextTrigger, trigger, 0, [], references);
        return;
      }

      void loadReferences().then((loaded) => {
        refreshOpenState(textarea, nextTrigger, trigger, 0, [], loaded ?? []);
      });
    },
    [applyEditorChange, close, loadReferences, refreshOpenState, state.trigger],
  );

  const toggleSelectedCiteKey = useCallback((citeKey: string) => {
    setState((prev) => {
      const selected = prev.selectedCiteKeys.includes(citeKey)
        ? prev.selectedCiteKeys.filter((key) => key !== citeKey)
        : [...prev.selectedCiteKeys, citeKey];
      return { ...prev, selectedCiteKeys: normalizeCiteKeys(selected) };
    });
  }, []);

  const highlightIndex = useCallback((index: number) => {
    setState((prev) => {
      if (!prev.open || prev.items.length === 0) return prev;
      const next = Math.max(0, Math.min(index, prev.items.length - 1));
      if (next === prev.selectedIndex) return prev;
      return { ...prev, selectedIndex: next };
    });
  }, []);

  const applyItem = useCallback(
    (
      textarea: HTMLTextAreaElement | null | undefined,
      item: AssetCompletionItem,
      onApply: (value: string, cursor: number) => void,
    ) => {
      const target = textarea ?? lastTextareaRef.current;
      if (!target) return;
      const trigger = state.trigger ?? activeTriggerRef.current;
      if (!trigger) return;
      if (trigger.kind === "cite" && item.citeKey) {
        const attached = pendingCiteKeysFromTrigger(trigger);
        if (attached.includes(item.citeKey)) {
          const index = state.items.findIndex((entry) => entry.citeKey === item.citeKey);
          highlightIndex(index >= 0 ? index : state.selectedIndex);
          return;
        }
        if (state.selectedCiteKeys.length > 0) {
          const index = state.items.findIndex((entry) => entry.citeKey === item.citeKey);
          finalizeCiteKeys(
            target,
            citeKeysToInsert(state.items, index >= 0 ? index : state.selectedIndex, state.selectedCiteKeys),
            onApply,
          );
          return;
        }
        continueCite(target, item.citeKey, onApply);
        return;
      }
      const result = applyAssetCompletion(target.value, trigger, item);
      applyEditorChange(target, result.value, result.cursor, onApply);
      close();
    },
    [
      applyEditorChange,
      close,
      continueCite,
      finalizeCiteKeys,
      highlightIndex,
      state.items,
      state.selectedCiteKeys,
      state.selectedIndex,
      state.trigger,
    ],
  );

  const handleKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLTextAreaElement>,
      onApply: (value: string, cursor: number) => void,
    ): boolean => {
      if (!state.open) return false;
      const textarea = event.currentTarget;
      lastTextareaRef.current = textarea;

      if (event.key === "Escape") {
        event.preventDefault();
        if (state.trigger?.kind === "cite" && pendingCiteKeysFromTrigger(state.trigger).length > 0) {
          finalizeCite(textarea, onApply);
        } else {
          close();
        }
        return true;
      }

      if (state.items.length === 0) {
        return false;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setState((prev) => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, prev.items.length - 1),
        }));
        return true;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setState((prev) => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, 0),
        }));
        return true;
      }

      if (event.key === " " && state.trigger?.kind === "cite") {
        event.preventDefault();
        const citeKey = state.items[state.selectedIndex]?.citeKey;
        if (citeKey) toggleSelectedCiteKey(citeKey);
        return true;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        if (state.trigger?.kind === "cite") {
          if (event.ctrlKey || event.metaKey) {
            finalizeCite(textarea, onApply);
            return true;
          }
          const keys = citeKeysToInsert(state.items, state.selectedIndex, state.selectedCiteKeys);
          if (state.selectedCiteKeys.length > 0) {
            finalizeCiteKeys(textarea, keys, onApply);
            return true;
          }
          const citeKey = state.items[state.selectedIndex]?.citeKey;
          if (citeKey) {
            continueCite(textarea, citeKey, onApply);
            return true;
          }
          finalizeCite(textarea, onApply);
          return true;
        }
        const item = state.items[state.selectedIndex];
        if (item) applyItem(textarea, item, onApply);
        return true;
      }

      return false;
    },
    [applyItem, close, continueCite, finalizeCite, finalizeCiteKeys, state, toggleSelectedCiteKey],
  );

  return {
    state,
    sync,
    close,
    handleKeyDown,
    handleEditorBlur,
    applyItem,
    highlightIndex,
    toggleSelectedCiteKey,
    beginPopupInteraction,
    endPopupInteraction,
    commandLabel: state.trigger ? assetCommandLabel(state.trigger.kind) : null,
    isCiteMode: state.trigger?.kind === "cite",
    attachedCiteKeys: state.trigger ? pendingCiteKeysFromTrigger(state.trigger) : [],
  };
}
