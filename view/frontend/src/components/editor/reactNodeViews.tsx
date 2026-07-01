/**
 * React-backed ProseMirror node views for the TreeWriter editor: render the
 * existing figure/equation/citation cards inside the PM document so embeds show
 * their content and citations are clickable — matching the legacy editor.
 */
import { createRoot, type Root } from "react-dom/client";
import type { NodeView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";

import { FigureCard } from "@/components/editor/FigureCard";
import { EquationCard } from "@/components/editor/EquationCard";
import { CiteBadge } from "@/components/editor/CiteBadge";
import type { NavigateTarget } from "@/lib/modelTree";

export type NodeViewContext = {
  onNavigate?: (target: NavigateTarget) => void;
  linkContextPath?: string;
  linksClickable?: boolean;
  refreshVersion?: number;
  /** Open the citation picker to edit an existing citation node in place. */
  onEditCitation?: (node: PMNode, getPos: () => number | undefined) => void;
};

/** Mounts a React render for an atom node; React owns the node's DOM. */
class ReactAtomNodeView implements NodeView {
  dom: HTMLElement;
  private root: Root;
  private readonly type;
  private readonly renderFn: (node: PMNode) => React.ReactNode;

  constructor(node: PMNode, inline: boolean, renderFn: (node: PMNode) => React.ReactNode) {
    this.type = node.type;
    this.renderFn = renderFn;
    this.dom = document.createElement(inline ? "span" : "div");
    this.dom.className = inline ? "tw-node-view tw-node-view--inline" : "tw-node-view";
    this.root = createRoot(this.dom);
    this.root.render(renderFn(node));
  }

  update(node: PMNode): boolean {
    if (node.type !== this.type) return false;
    this.root.render(this.renderFn(node));
    return true;
  }

  stopEvent(): boolean {
    return true; // React handles interaction inside the card.
  }

  ignoreMutation(): boolean {
    return true; // React owns this subtree; PM must not read it as content.
  }

  destroy(): void {
    const root = this.root;
    // Defer to avoid unmounting during React's render phase.
    queueMicrotask(() => root.unmount());
  }
}

function citeKeys(node: PMNode): string {
  return String(node.attrs.keys ?? "").replace(/@/g, "").trim();
}
function firstCiteKey(node: PMNode): string {
  return citeKeys(node).split(/[;,]/)[0]?.trim() ?? "";
}

export function buildNodeViews(ctxRef: { current: NodeViewContext }) {
  const ctx = () => ctxRef.current;
  return {
    figure_embed: (node: PMNode) =>
      new ReactAtomNodeView(node, false, (n) => (
        <FigureCard
          targetPath={n.attrs.target as string}
          embeddedInEditor
          refreshVersion={ctx().refreshVersion}
          linkContextPath={ctx().linkContextPath}
          linksClickable={ctx().linksClickable}
          onNavigate={ctx().onNavigate}
        />
      )),
    equation_embed: (node: PMNode) =>
      new ReactAtomNodeView(node, false, (n) => (
        <EquationCard targetPath={n.attrs.target as string} embeddedInEditor refreshVersion={ctx().refreshVersion} />
      )),
    citation: (node: PMNode, _view: unknown, getPos: () => number | undefined) =>
      new ReactAtomNodeView(node, true, (n) => (
        <CiteBadge
          citeKey={citeKeys(n) || (n.attrs.keys as string)}
          onOpen={() => {
            // Click opens the picker to edit this citation's keys in place;
            // falls back to navigating to the reference.
            if (ctx().onEditCitation) {
              ctx().onEditCitation!(n, getPos);
              return;
            }
            if (!ctx().linksClickable) return;
            const target = firstCiteKey(n);
            if (target) ctx().onNavigate?.({ type: "bib", citeKey: target });
          }}
        />
      )),
  };
}
