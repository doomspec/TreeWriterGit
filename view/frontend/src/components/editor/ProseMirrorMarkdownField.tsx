import { useEffect, useImperativeHandle, useRef, useState } from "react";

import "prosemirror-view/style/prosemirror.css";
import "@/styles/prosemirror-editor.css";

import { EditorState, TextSelection, type Command } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Slice, type Node as PMNode } from "prosemirror-model";
import { toggleMark, setBlockType, wrapIn } from "prosemirror-commands";
import { wrapInList } from "prosemirror-schema-list";
import { undo, redo, undoDepth, redoDepth } from "prosemirror-history";

import { authorNoteMacro } from "@/lib/inlineNotes";
import { getUserName } from "@/lib/userIdentity";
import type { MarkdownFormatAction } from "@/lib/markdownFormat";
import {
  clearFind,
  getFindState,
  replaceAll as replaceAllMatches,
  replaceCurrent,
  setFindQuery,
  stepFind,
} from "@/lib/editorEngine/findReplace";
import { setPendingDiffBaseline } from "@/lib/editorEngine/pendingDiff";
import { buildNodeViews, type NodeViewContext } from "@/components/editor/reactNodeViews";
import { useBibSearchResults } from "@/lib/bibLibraryStore";

import { twSchema } from "@/lib/editorEngine/schema";
import { parseMarkdown, serializeMarkdown } from "@/lib/editorEngine/roundtrip";
import { twEditorPlugins } from "@/lib/editorEngine/plugins";
import type { BlockMarkdownEditorHandle } from "@/components/editor/editorHandle";
import { formatChord } from "@/lib/keyboardChords";
import { navigateFromEditorLink, shouldNavigateLinkFromClick } from "@/lib/linkNavigation";
import { resolveNavigateTarget, type NavigateTarget } from "@/lib/modelTree";
import { cn } from "@/lib/utils";

const FIND_SHORTCUT = formatChord("Mod+Shift+F");

type FormatTransform = (
  value: string,
  start: number,
  end: number,
) => { value: string; selectionStart: number; selectionEnd: number };

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect?: () => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  editorRef?: React.RefObject<BlockMarkdownEditorHandle | null>;
  onNavigate?: (target: NavigateTarget) => void;
  linkContextPath?: string;
  linksClickable?: boolean;
  /** Fires with the format actions active at the caret/selection. */
  onActiveFormatsChange?: (actions: string[]) => void;
  /**
   * Approved-baseline markdown; when showPendingDiff is on, edits since it are
   * highlighted inline. `null`/omitted means no approval record exists yet —
   * distinct from `""`, which means something WAS approved while still empty.
   * A truthy check here would treat both the same and silently suppress
   * highlighting for a still-empty-but-approved unit's later edits.
   */
  approvedBaseline?: string | null;
  showPendingDiff?: boolean;
  refreshVersion?: number;
};

function firstCiteKey(raw: string): string {
  const first = raw.split(/[;,]/)[0]?.trim() ?? "";
  return first.replace(/^@/, "").trim();
}

/**
 * Stage 5 (feature-flagged) ProseMirror markdown editing surface.
 *
 * Editing is markdown-canonical: the document is parsed once into a
 * ProseMirror doc and serialized back to markdown on every change, with no
 * HTML round-trip. Primary formatting is keyboard-driven (Mod-b/i/`, markdown
 * input rules). The toolbar `applyTo*` bridge below is a v1 approximation that
 * operates on the active block's text; replacing the toolbar with native PM
 * commands is the planned follow-up.
 */
export function ProseMirrorMarkdownField({
  value,
  onChange,
  onSelect,
  className,
  ariaLabel,
  placeholder,
  editorRef,
  onNavigate,
  linkContextPath = "",
  linksClickable = false,
  onActiveFormatsChange,
  approvedBaseline = null,
  showPendingDiff = false,
  refreshVersion = 0,
}: Props) {
  const navRef = useRef({ onNavigate, linkContextPath, linksClickable });
  navRef.current = { onNavigate, linkContextPath, linksClickable };
  const activeFormatsRef = useRef(onActiveFormatsChange);
  activeFormatsRef.current = onActiveFormatsChange;
  const [findOpen, setFindOpen] = useState(false);
  const openFindRef = useRef(() => setFindOpen(true));
  const [citePicker, setCitePicker] = useState<{ seed: string[]; commit: (keys: string[]) => void } | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Insert a new citation node (one or more keys) at the caret.
  const insertCitationKeys = (keys: string[]) => {
    const v = viewRef.current;
    if (!v || !keys.length) return;
    const node = twSchema.nodes.citation.create({ keys: keys.map((k) => `@${k}`).join("; "), latex: false });
    v.dispatch(v.state.tr.replaceSelectionWith(node, false).scrollIntoView());
    v.focus();
  };
  // Replace (or delete) an existing citation node's keys.
  const replaceCitationKeys = (getPos: () => number | undefined) => (keys: string[]) => {
    const v = viewRef.current;
    if (!v) return;
    const pos = getPos();
    if (pos == null) return;
    const node = v.state.doc.nodeAt(pos);
    if (!node) return;
    if (!keys.length) v.dispatch(v.state.tr.delete(pos, pos + node.nodeSize));
    else v.dispatch(v.state.tr.setNodeMarkup(pos, undefined, { keys: keys.map((k) => `@${k}`).join("; "), latex: false }));
    v.focus();
  };
  const openCiteRef = useRef(() => setCitePicker({ seed: [], commit: insertCitationKeys }));
  openCiteRef.current = () => setCitePicker({ seed: [], commit: insertCitationKeys });

  const nodeCtxRef = useRef<NodeViewContext>({});
  nodeCtxRef.current = {
    onNavigate,
    linkContextPath,
    linksClickable,
    refreshVersion,
    onEditCitation: (node, getPos) =>
      setCitePicker({
        seed: String(node.attrs.keys ?? "")
          .replace(/@/g, "")
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        commit: replaceCitationKeys(getPos),
      }),
  };
  // Last markdown we emitted, to distinguish external value changes from echoes.
  const lastEmittedRef = useRef<string>(value);
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelect);
  onChangeRef.current = onChange;
  onSelectRef.current = onSelect;

  // Mount once.
  useEffect(() => {
    if (!hostRef.current) return;
    const state = EditorState.create({ doc: parseMarkdown(value), plugins: twEditorPlugins() });
    const view = new EditorView(hostRef.current, {
      state,
      nodeViews: buildNodeViews(nodeCtxRef),
      dispatchTransaction(tr) {
        const next = view.state.apply(tr);
        view.updateState(next);
        if (tr.docChanged) {
          const md = serializeMarkdown(next.doc);
          lastEmittedRef.current = md;
          onChangeRef.current(md);
        }
        if (tr.selectionSet) onSelectRef.current?.();
        if (tr.docChanged || tr.selectionSet) {
          activeFormatsRef.current?.(computeActiveFormats(next));
        }
      },
      attributes: {
        // Reuse the app's rendered-prose typography (headings, lists, links).
        class: "markdown-body markdown-reading",
        ...(ariaLabel ? { "aria-label": ariaLabel, role: "textbox" } : {}),
      },
      handleDOMEvents: {
        // Toggle a task-list checkbox when its (pseudo-element) box is clicked.
        mousedown: (v, event) => toggleTaskCheckbox(v, event as MouseEvent),
        keydown: (v, event) => {
          // Shift+Cmd/Ctrl+F (plain Cmd+F is taken by the browser's find).
          if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "f") {
            event.preventDefault();
            openFindRef.current();
            return true;
          }
          // "@" at a word boundary opens the citation picker (Jenni-style).
          if (event.key === "@" && !event.metaKey && !event.ctrlKey && !event.altKey) {
            const { $from, empty } = v.state.selection;
            if (empty && $from.parent.isTextblock) {
              const prev = $from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset);
              if (prev === "" || /\s/.test(prev)) {
                event.preventDefault();
                openCiteRef.current();
                return true;
              }
            }
          }
          return false;
        },
      },
    });
    viewRef.current = view;
    activeFormatsRef.current?.(computeActiveFormats(view.state));
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feed the approved baseline to the pending-diff plugin.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    setPendingDiffBaseline(view, showPendingDiff && approvedBaseline !== null ? approvedBaseline : null);
  }, [approvedBaseline, showPendingDiff]);

  // External value changes (file reload, AI edit) replace the doc.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (value === lastEmittedRef.current) return;
    // Already in sync with the live doc (echoed prop): don't reparse/replace,
    // which would reset the selection and could clobber a just-applied edit.
    if (value === serializeMarkdown(view.state.doc)) {
      lastEmittedRef.current = value;
      return;
    }
    const doc = parseMarkdown(value);
    const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
    tr.setMeta("addToHistory", false);
    view.updateState(view.state.apply(tr));
    lastEmittedRef.current = value;
  }, [value]);

  useImperativeHandle(
    editorRef,
    (): BlockMarkdownEditorHandle => ({
      isBlockEditing: () => viewRef.current?.hasFocus() ?? false,
      getCursorLineNumber: () => {
        const view = viewRef.current;
        if (!view) return null;
        const head = view.state.selection.head;
        const before = view.state.doc.cut(0, head);
        return serializeMarkdown(before).split("\n").length;
      },
      insertSnippet: (snippet: string) => {
        const view = viewRef.current;
        if (!view) return false;
        const parsed = parseMarkdown(snippet);
        const slice = new Slice(parsed.content, 0, 0);
        view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
        view.focus();
        return true;
      },
      applyToActiveBlock: (transform) => applyBlockTransform(viewRef.current, transform),
      applyToRenderedSelection: (transform) => applyBlockTransform(viewRef.current, transform),
      runFormat: (action) => runCommand(viewRef.current, formatCommand(action)),
      runHighlight: (color) => runCommand(viewRef.current, toggleMark(twSchema.marks.highlight, { color })),
      runInlineNote: () => runCommand(viewRef.current, insertAuthorNoteCommand),
      runUndo: () => runCommand(viewRef.current, undo),
      runRedo: () => runCommand(viewRef.current, redo),
      canUndo: () => (viewRef.current ? undoDepth(viewRef.current.state) > 0 : false),
      canRedo: () => (viewRef.current ? redoDepth(viewRef.current.state) > 0 : false),
    }),
    [],
  );

  // Mod/Ctrl-click (or middle-click) follows links/chips; a plain click edits.
  // The open-hint tooltip (schema toDOM titles) tells users to modifier-click.
  const onHostClick = (event: React.MouseEvent) => {
    const { onNavigate: nav, linkContextPath: ctx, linksClickable: clickable } = navRef.current;
    if (!nav || !clickable) return;
    if (!shouldNavigateLinkFromClick(event)) return;
    const el = event.target as Element;
    const chip = el.closest("[data-wikilink],[data-citation],[data-figure-embed],[data-equation-embed]");
    if (chip) {
      let target: NavigateTarget | null = null;
      if (chip.hasAttribute("data-wikilink")) {
        target = resolveNavigateTarget(ctx, chip.getAttribute("data-wikilink") ?? "");
      } else if (chip.hasAttribute("data-citation")) {
        const key = firstCiteKey(chip.getAttribute("data-citation") ?? "");
        if (key) target = { type: "bib", citeKey: key };
      } else if (chip.hasAttribute("data-figure-embed")) {
        target = { type: "folder", path: chip.getAttribute("data-figure-embed") ?? "" };
      } else if (chip.hasAttribute("data-equation-embed")) {
        target = { type: "folder", path: chip.getAttribute("data-equation-embed") ?? "" };
      }
      if (target) {
        nav(target);
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    // Standard markdown links render as <a href> (link mark).
    const anchor = el.closest("a");
    const href = anchor?.getAttribute("href");
    if (href && navigateFromEditorLink(href, ctx, nav, clickable)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <div className={cn("prosemirror-markdown-field relative w-full", className)}>
      {findOpen ? (
        <FindReplaceBar
          getView={() => viewRef.current}
          onClose={() => {
            const v = viewRef.current;
            if (v) {
              clearFind(v);
              v.focus();
            }
            setFindOpen(false);
          }}
        />
      ) : null}
      {citePicker ? (
        <CitationPicker
          seed={citePicker.seed}
          onCommit={(keys) => {
            citePicker.commit(keys);
            setCitePicker(null);
          }}
          onClose={() => {
            viewRef.current?.focus();
            setCitePicker(null);
          }}
        />
      ) : null}
      <div ref={hostRef} data-placeholder={placeholder} onClick={onHostClick} />
    </div>
  );
}

function markActive(state: EditorState, type: import("prosemirror-model").MarkType): boolean {
  const { from, to, empty, $from } = state.selection;
  if (empty) return !!type.isInSet(state.storedMarks || $from.marks());
  return state.doc.rangeHasMark(from, to, type);
}

/** Format-action keys active at the caret/selection (for toolbar highlighting). */
function computeActiveFormats(state: EditorState): string[] {
  const m = twSchema.marks;
  const n = twSchema.nodes;
  const out: string[] = [];
  if (markActive(state, m.strong)) out.push("bold");
  if (markActive(state, m.em)) out.push("italic");
  if (markActive(state, m.strikethrough)) out.push("strikethrough");
  if (markActive(state, m.subscript)) out.push("subscript");
  if (markActive(state, m.superscript)) out.push("superscript");
  if (markActive(state, m.link)) out.push("link");
  if (markActive(state, m.code)) out.push("code");
  const $from = state.selection.$from;
  for (let d = $from.depth; d >= 0; d -= 1) {
    const node = $from.node(d);
    if (node.type === n.heading) out.push(`h${node.attrs.level}`);
    else if (node.type === n.code_block) out.push("codeBlock");
    else if (node.type === n.bullet_list) out.push("bulletList");
    else if (node.type === n.ordered_list) out.push("orderedList");
    else if (node.type === n.blockquote) out.push("blockquote");
    else if (node.type === n.list_item && node.attrs.checked !== null) out.push("taskList");
  }
  return out;
}

/** Toggle a task item's checked state when its checkbox pseudo-element is clicked. */
function toggleTaskCheckbox(view: EditorView, event: MouseEvent): boolean {
  const el = event.target as HTMLElement | null;
  const li = el?.closest("li[data-task]") as HTMLElement | null;
  if (!li) return false;
  const rect = li.getBoundingClientRect();
  const boxWidth = parseFloat(getComputedStyle(li).paddingLeft) || 24;
  if (event.clientX > rect.left + boxWidth) return false; // click was on the text, not the box
  const pos = view.posAtDOM(li, 0);
  const $pos = view.state.doc.resolve(pos);
  const liType = twSchema.nodes.list_item;
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    const node = $pos.node(depth);
    if (node.type === liType) {
      const liPos = $pos.before(depth);
      view.dispatch(
        view.state.tr.setNodeMarkup(liPos, undefined, { ...node.attrs, checked: node.attrs.checked !== true }),
      );
      event.preventDefault();
      return true;
    }
  }
  return false;
}

function runCommand(view: EditorView | null, command: Command): boolean {
  if (!view) return false;
  const handled = command(view.state, view.dispatch, view);
  view.focus();
  return handled;
}

/** Map a toolbar format action to a native ProseMirror command. */
function formatCommand(action: MarkdownFormatAction): Command {
  const n = twSchema.nodes;
  const m = twSchema.marks;
  switch (action) {
    case "bold":
      return toggleMark(m.strong);
    case "italic":
      return toggleMark(m.em);
    case "strikethrough":
      return toggleMark(m.strikethrough);
    case "subscript":
      return toggleMark(m.subscript);
    case "superscript":
      return toggleMark(m.superscript);
    case "code":
      return toggleMark(m.code);
    case "codeBlock":
      return setBlockType(n.code_block);
    case "taskList":
      return taskListCommand;
    case "h1":
      return setBlockType(n.heading, { level: 1 });
    case "h2":
      return setBlockType(n.heading, { level: 2 });
    case "h3":
      return setBlockType(n.heading, { level: 3 });
    case "paragraph":
      return setBlockType(n.paragraph);
    case "bulletList":
      return wrapInList(n.bullet_list);
    case "orderedList":
      return wrapInList(n.ordered_list);
    case "blockquote":
      return wrapIn(n.blockquote);
    case "link":
      return linkCommand;
    default:
      return () => false;
  }
}

// Toggle the selected lines into an (unchecked) task list. If already list
// items, flips their `checked` attr between task and plain; otherwise wraps in
// a bullet list and marks the new items as tasks.
const taskListCommand: Command = (state, dispatch, view) => {
  const liType = twSchema.nodes.list_item;
  const items: Array<{ pos: number; node: PMNode }> = [];
  state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
    if (node.type === liType) items.push({ pos, node });
  });
  if (items.length) {
    if (!dispatch) return true;
    const tr = state.tr;
    const anyPlain = items.some((i) => i.node.attrs.checked === null);
    items.forEach(({ pos, node }) =>
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: anyPlain ? false : null }),
    );
    dispatch(tr.scrollIntoView());
    return true;
  }
  return wrapInList(twSchema.nodes.bullet_list)(
    state,
    dispatch
      ? (tr) => {
          const from = tr.mapping.map(state.selection.from);
          const to = tr.mapping.map(state.selection.to);
          tr.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type === liType) tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: false });
          });
          dispatch(tr.scrollIntoView());
        }
      : undefined,
    view,
  );
};

const linkCommand: Command = (state, dispatch, view) => {
  const href = typeof window !== "undefined" ? window.prompt("Link URL")?.trim() : "";
  if (!href) return false;
  return toggleMark(twSchema.marks.link, { href })(state, dispatch, view);
};

const insertAuthorNoteCommand: Command = (state, dispatch) => {
  const { from, to, empty } = state.selection;
  const text = empty ? "…" : state.doc.textBetween(from, to, " ");
  const author = authorNoteMacro(getUserName());
  const node = twSchema.nodes.author_note.create({ author, text });
  if (dispatch) dispatch(state.tr.replaceSelectionWith(node, false).scrollIntoView());
  return true;
};

/** v1 toolbar bridge: re-emit the active block from a markdown-string transform. */
function applyBlockTransform(view: EditorView | null, transform: FormatTransform): boolean {
  if (!view) return false;
  const { $from, $to } = view.state.selection;
  if (!$from.sameParent($to) || !$from.parent.isTextblock) return false;
  const blockStart = $from.start();
  const blockEnd = $from.end();
  const text = $from.parent.textContent;
  const selStart = $from.parentOffset;
  const selEnd = $to.parentOffset;
  const result = transform(text, selStart, selEnd);
  const parsed = parseMarkdown(result.value);
  // parsed is a doc; splice its block content in place of the active block.
  const tr = view.state.tr.replaceWith(blockStart, blockEnd, parsed.content.size ? parsed.firstChild!.content : view.state.schema.text(" ").mark([]));
  const caret = Math.min(blockStart + result.selectionEnd, tr.doc.content.size);
  tr.setSelection(TextSelection.create(tr.doc, caret));
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

/**
 * Inline citation search popover (main.bib). Supports multiple keys: click or
 * Enter adds a key to the selection; Insert commits `[@a; @b]`. Seeded with
 * existing keys when editing a citation in place.
 */
function CitationPicker({
  seed,
  onCommit,
  onClose,
}: {
  seed: string[];
  onCommit: (citeKeys: string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<string[]>(seed);
  const { entries, loading } = useBibSearchResults(query, "all", 30);
  const results = entries.slice(0, 30);
  const clampedActive = Math.min(active, Math.max(0, results.length - 1));
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [clampedActive]);

  const toggle = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <div
      data-editor-floating-chrome
      className="absolute left-2 top-2 z-overlay w-80 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-lg"
    >
      {selected.length ? (
        <div className="mb-1 flex flex-wrap gap-1">
          {selected.map((key) => (
            <button
              key={key}
              type="button"
              className="flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground"
              title="Remove"
              onClick={() => toggle(key)}
            >
              @{key} ✕
            </button>
          ))}
        </div>
      ) : null}
      <input
        autoFocus
        className="h-7 w-full rounded border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Cite… (Enter adds · ⌘Enter inserts · Esc cancels)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (e.metaKey || e.ctrlKey) {
              if (selected.length) onCommit(selected);
              return;
            }
            const pick = results[clampedActive];
            if (pick) {
              toggle(pick.citeKey);
              setQuery("");
            } else if (selected.length) {
              onCommit(selected);
            }
          }
        }}
      />
      <div className="mt-1 max-h-56 overflow-auto">
        {loading && !results.length ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">Searching…</p>
        ) : results.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            {query ? "No matching references in main.bib." : "Type to search main.bib."}
          </p>
        ) : (
          results.map((ref, i) => (
            <button
              key={ref.citeKey}
              ref={i === clampedActive ? activeItemRef : undefined}
              type="button"
              className={cn(
                "flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left",
                // ring-inset: draws inside the border box so it isn't clipped
                // by the scrollable list's edges (a non-inset ring extends
                // outside the box and gets cut off left/right).
                selected.includes(ref.citeKey) && "ring-1 ring-inset ring-primary",
                i === clampedActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
              )}
              onMouseEnter={() => setActive(i)}
              onClick={() => toggle(ref.citeKey)}
            >
              <span className="line-clamp-1 text-xs font-medium">{ref.title || ref.citeKey}</span>
              <span className="line-clamp-1 text-[10px] text-muted-foreground">
                @{ref.citeKey}
                {ref.authors ? ` · ${ref.authors}` : ""}
                {ref.year ? ` · ${ref.year}` : ""}
              </span>
            </button>
          ))
        )}
      </div>
      <div className="mt-1 flex items-center justify-end gap-1 border-t border-border pt-1">
        <button type="button" className="h-7 rounded px-2 text-xs hover:bg-accent" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="h-7 rounded bg-primary px-2 text-xs text-primary-foreground disabled:opacity-50"
          disabled={!selected.length}
          onClick={() => onCommit(selected)}
        >
          {seed.length ? "Update" : "Insert"} {selected.length ? `(${selected.length})` : ""}
        </button>
      </div>
    </div>
  );
}

function FindReplaceBar({
  getView,
  onClose,
}: {
  getView: () => EditorView | null;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [info, setInfo] = useState({ count: 0, index: 0 });

  const refresh = () => {
    const v = getView();
    if (!v) return;
    const s = getFindState(v);
    setInfo({ count: s.matches.length, index: s.index });
  };

  useEffect(() => {
    const v = getView();
    if (!v) return;
    setFindQuery(v, query, caseSensitive);
    const s = getFindState(v);
    setInfo({ count: s.matches.length, index: s.index });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, caseSensitive]);

  const step = (dir: 1 | -1) => {
    const v = getView();
    if (v) {
      stepFind(v, dir);
      refresh();
    }
  };
  const doReplace = () => {
    const v = getView();
    if (v) {
      replaceCurrent(v, replaceText);
      stepFind(v, 1);
      refresh();
    }
  };
  const doReplaceAll = () => {
    const v = getView();
    if (v) {
      replaceAllMatches(v, replaceText);
      refresh();
    }
  };

  const inputCls =
    "h-7 w-40 rounded border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const btnCls = "h-7 rounded px-2 text-xs hover:bg-accent hover:text-accent-foreground";

  return (
    <div
      data-editor-floating-chrome
      className="absolute right-2 top-2 z-overlay flex flex-col gap-1 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-lg"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex items-center gap-1">
        <input
          autoFocus
          className={inputCls}
          placeholder={`Find (${FIND_SHORTCUT})`}
          title={`Find in document (${FIND_SHORTCUT})`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              step(e.shiftKey ? -1 : 1);
            }
          }}
        />
        <span className="w-14 shrink-0 text-center font-mono text-[10px] text-muted-foreground">
          {info.count ? `${info.index + 1}/${info.count}` : "0/0"}
        </span>
        <button type="button" className={btnCls} title="Previous (Shift+Enter)" onClick={() => step(-1)}>
          ↑
        </button>
        <button type="button" className={btnCls} title="Next (Enter)" onClick={() => step(1)}>
          ↓
        </button>
        <button
          type="button"
          className={cn(btnCls, caseSensitive && "bg-accent text-accent-foreground")}
          title="Match case"
          aria-pressed={caseSensitive}
          onClick={() => setCaseSensitive((v) => !v)}
        >
          Aa
        </button>
        <button type="button" className={btnCls} title="Close (Esc)" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="flex items-center gap-1">
        <input
          className={inputCls}
          placeholder="Replace"
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && info.count) {
              e.preventDefault();
              if (e.metaKey || e.ctrlKey) doReplaceAll();
              else doReplace();
            }
          }}
        />
        <button type="button" className={btnCls} disabled={!info.count} onClick={doReplace}>
          Replace
        </button>
        <button type="button" className={btnCls} disabled={!info.count} onClick={doReplaceAll}>
          All
        </button>
      </div>
    </div>
  );
}
