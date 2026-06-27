import { select } from "d3-selection";
import { zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";

export interface GraphLayoutNode {
  x?: number;
  y?: number;
  isFocus?: boolean;
  links: number;
}

export type GraphBounds = Pick<DOMRect, "x" | "y" | "width" | "height">;

export interface GraphFitOptions {
  padding?: number;
  minScale?: number;
  maxScale?: number;
}

export function graphNodeRadius(node: GraphLayoutNode): number {
  return (node.isFocus ? 10 : 7) + Math.min(node.links, 4);
}

export function graphLabelText(label: string, embedded: boolean): string {
  const maxLen = embedded ? 16 : 22;
  if (label.length <= maxLen) return label;
  return `${label.slice(0, maxLen - 1).trimEnd()}…`;
}

export function graphFitOptions(embedded: boolean, minimal: boolean): GraphFitOptions {
  return {
    padding: minimal ? 0.82 : 0.9,
    maxScale: embedded || minimal ? 1.6 : 2.5,
  };
}

/** Bounds from node positions only — excludes hover labels so fit zoom stays stable. */
export function computeNodeBounds(nodes: GraphLayoutNode[], margin = 20): GraphBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;
    const pad = graphNodeRadius(node) + margin;
    minX = Math.min(minX, node.x - pad);
    minY = Math.min(minY, node.y - pad);
    maxX = Math.max(maxX, node.x + pad);
    maxY = Math.max(maxY, node.y + pad);
  }

  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Fit graph content into the viewport (Quartz-style initial scale/center). */
export function computeFitTransform(
  bounds: GraphBounds,
  width: number,
  height: number,
  options: GraphFitOptions = {},
): ZoomTransform | null {
  const { padding = 0.9, minScale = 0.25, maxScale = 3 } = options;
  if (bounds.width <= 0 || bounds.height <= 0 || width <= 0 || height <= 0) {
    return null;
  }

  const midX = bounds.x + bounds.width / 2;
  const midY = bounds.y + bounds.height / 2;
  const scale = padding / Math.max(bounds.width / width, bounds.height / height);
  const clampedScale = Math.min(maxScale, Math.max(minScale, scale));

  return zoomIdentity
    .translate(width / 2 - clampedScale * midX, height / 2 - clampedScale * midY)
    .scale(clampedScale);
}

export function applyFitTransform(
  svg: SVGSVGElement,
  behavior: ZoomBehavior<SVGSVGElement, unknown>,
  bounds: GraphBounds | null,
  width: number,
  height: number,
  options?: GraphFitOptions,
): ZoomTransform | null {
  if (!bounds) return null;
  const transform = computeFitTransform(bounds, width, height, options);
  if (!transform) return null;
  select(svg).call(behavior.transform, transform);
  return transform;
}
