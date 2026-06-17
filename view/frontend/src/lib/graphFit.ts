import { select } from "d3-selection";
import { zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";

/** Fit graph content into the viewport (Quartz-style initial scale/center). */
export function computeFitTransform(
  bounds: DOMRect,
  width: number,
  height: number,
  padding = 0.9,
): ZoomTransform | null {
  if (bounds.width <= 0 || bounds.height <= 0 || width <= 0 || height <= 0) {
    return null;
  }

  const midX = bounds.x + bounds.width / 2;
  const midY = bounds.y + bounds.height / 2;
  const scale = padding / Math.max(bounds.width / width, bounds.height / height);
  const clampedScale = Math.min(3, Math.max(0.25, scale));

  return zoomIdentity
    .translate(width / 2 - clampedScale * midX, height / 2 - clampedScale * midY)
    .scale(clampedScale);
}

export function applyFitTransform(
  svg: SVGSVGElement,
  behavior: ZoomBehavior<SVGSVGElement, unknown>,
  layer: SVGGElement,
  width: number,
  height: number,
): ZoomTransform | null {
  const transform = computeFitTransform(layer.getBBox(), width, height);
  if (!transform) return null;
  select(svg).call(behavior.transform, transform);
  return transform;
}
