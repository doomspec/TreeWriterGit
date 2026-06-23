import { useEffect, useMemo, useRef, useState } from "react";
import { zoom } from "d3-zoom";
import { select } from "d3-selection";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

import { cn } from "@/lib/utils";
import {
  filterLocalGraph,
  resolveFocusId,
  shouldShowLabel,
  type GraphNodeType,
  type GraphScope,
} from "@/lib/graphLocal";
import { applyFitTransform, computeFitTransform } from "@/lib/graphFit";
import { fetchModelGraph, type ModelGraphEdge, type ModelGraphNode } from "@/modelApi";

interface RawNode {
  id: string;
  label: string;
  type: GraphNodeType;
  links: number;
}
interface RawEdge {
  source: string;
  target: string;
  kind?: "outline" | "contains";
}

type SimNode = RawNode & SimulationNodeDatum & { isFocus?: boolean };
type SimEdge = SimulationLinkDatum<SimNode> & { kind?: "outline" | "contains" };

const GRAPH_COLOR_VAR: Record<GraphNodeType, string> = {
  paper: "--graph-paper",
  section: "--graph-section",
  unit: "--graph-unit",
  figure: "--graph-note",
  note: "--graph-note",
  doc: "--graph-doc",
  missing: "--graph-missing",
};

function graphColor(type: GraphNodeType): string {
  return `hsl(var(${GRAPH_COLOR_VAR[type]}))`;
}

const NODE_TYPE_LABEL: Record<GraphNodeType, string> = {
  paper: "Paper",
  section: "Section",
  unit: "Unit",
  figure: "Figure",
  note: "Note",
  doc: "Document",
  missing: "Missing link",
};

function edgeKindLabel(kind?: "outline" | "contains"): string {
  return kind === "contains" ? "Contains" : "Outline link";
}

function edgeHoverKey(sourceId: string, targetId: string): string {
  return `${sourceId}\0${targetId}`;
}

function endpointId(value: string | number | SimNode): string {
  return typeof value === "object" ? value.id : String(value);
}

export function GraphPanel({
  fetchRoot,
  focusPath,
  onSelectNode,
  onClose,
  embedded = false,
  graphScope: graphScopeProp,
  onGraphScopeChange,
  active = true,
  refreshVersion = 0,
  minimal = false,
}: {
  /** Directory passed to GET /api/model/graph?root= (paper root, not leaf unit). */
  fetchRoot: string;
  /** Current navigation path used to pick the focused node. */
  focusPath: string;
  onSelectNode: (id: string) => void;
  onClose?: () => void;
  embedded?: boolean;
  graphScope?: GraphScope;
  onGraphScopeChange?: (scope: GraphScope) => void;
  /** When false, skip layout measurement (panel hidden). */
  active?: boolean;
  /** Bump to refetch graph after model changes. */
  refreshVersion?: number;
  /** Hide chrome — graph canvas only (reading focus inline). */
  minimal?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomLayerRef = useRef<SVGGElement>(null);
  const [size, setSize] = useState({ w: 480, h: 360 });
  const [rawNodes, setRawNodes] = useState<RawNode[]>([]);
  const [rawEdges, setRawEdges] = useState<RawEdge[]>([]);
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simEdges, setSimEdges] = useState<SimEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [scope, setScopeInternal] = useState<GraphScope>(graphScopeProp ?? "local");
  const [depth, setDepth] = useState(1);

  useEffect(() => {
    if (graphScopeProp !== undefined) setScopeInternal(graphScopeProp);
  }, [graphScopeProp]);

  const setScope = (next: GraphScope) => {
    setScopeInternal(next);
    onGraphScopeChange?.(next);
  };

  useEffect(() => {
    if (!active) return;
    const el = containerRef.current;
    if (!el) return;

    let rafId: number | undefined;
    let debounceId: number | undefined;

    const updateSize = () => {
      const { width, height } = el.getBoundingClientRect();
      const w = Math.round(width);
      const h = Math.round(height);
      if (w <= 0 || h <= 0) return;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };

    const scheduleUpdateSize = () => {
      if (rafId !== undefined) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = undefined;
        window.clearTimeout(debounceId);
        debounceId = window.setTimeout(updateSize, 120);
      });
    };

    scheduleUpdateSize();
    const ro = new ResizeObserver(scheduleUpdateSize);
    ro.observe(el);
    return () => {
      if (rafId !== undefined) window.cancelAnimationFrame(rafId);
      window.clearTimeout(debounceId);
      ro.disconnect();
    };
  }, [active]);

  useEffect(() => {
    if (!fetchRoot) {
      setRawNodes([]);
      setRawEdges([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchModelGraph(fetchRoot)
      .then((data) => {
        if (cancelled) return;
        const nodes = data.nodes.filter((node) => node.type !== "missing") as RawNode[];
        const nodeIds = new Set(nodes.map((node) => node.id));
        const edges = data.edges.filter(
          (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
        );
        setRawNodes(nodes);
        setRawEdges(edges);
        setError(null);
        setLoading(false);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchRoot, refreshVersion]);

  const focusId = useMemo(() => resolveFocusId(rawNodes, focusPath), [rawNodes, focusPath]);

  const filtered = useMemo(
    () => filterLocalGraph(rawNodes, rawEdges, focusId, depth, scope),
    [rawNodes, rawEdges, focusId, depth, scope],
  );

  useEffect(() => {
    if (!active || loading || filtered.nodes.length === 0) {
      setSimNodes([]);
      setSimEdges([]);
      return;
    }

    const cx = size.w / 2;
    const cy = size.h / 2;
    const nodes: SimNode[] = filtered.nodes.map((n) => ({
      ...n,
      isFocus: n.id === filtered.focusId,
    }));
    const edges: SimEdge[] = filtered.edges.map((e) => ({
      source: e.source,
      target: e.target,
      kind: e.kind,
    }));

    const simulation = forceSimulation(nodes)
      .force(
        "link",
        forceLink<SimNode, SimEdge>(edges)
          .id((d) => d.id)
          .distance(48)
          .strength(0.85),
      )
      .force("charge", forceManyBody().strength(-420))
      .force("center", forceCenter(cx, cy))
      .force(
        "collide",
        forceCollide<SimNode>((d) => (d.isFocus ? 22 : 16) + Math.min(d.links, 4)),
      )
      .force(
        "x",
        forceX<SimNode>(cx).strength((d) => (d.isFocus ? 0.35 : 0.04)),
      )
      .force(
        "y",
        forceY<SimNode>(cy).strength((d) => (d.isFocus ? 0.35 : 0.04)),
      )
      .stop();

    const warmupTicks = minimal ? 24 : 48;
    for (let i = 0; i < warmupTicks; i += 1) simulation.tick();
    setSimNodes([...nodes]);
    setSimEdges([...edges]);

    return () => {
      simulation.stop();
    };
  }, [active, filtered, loading, minimal, size.h, size.w]);

  useEffect(() => {
    const svg = svgRef.current;
    const layer = zoomLayerRef.current;
    if (!svg || !layer || simNodes.length === 0) return;

    const fitLayer = () => {
      const transform = computeFitTransform(layer.getBBox(), size.w, size.h);
      if (transform) {
        select(layer).attr("transform", transform.toString());
      }
    };

    if (minimal) {
      const rafId = requestAnimationFrame(fitLayer);
      return () => cancelAnimationFrame(rafId);
    }

    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 3])
      .on("zoom", (event) => {
        select(layer).attr("transform", event.transform.toString());
      });

    const selection = select(svg).call(behavior);
    const rafId = requestAnimationFrame(() => {
      applyFitTransform(svg, behavior, layer, size.w, size.h);
    });

    return () => {
      cancelAnimationFrame(rafId);
      selection.on(".zoom", null);
    };
  }, [filtered.focusId, filtered.nodes.length, minimal, scope, depth, simNodes.length, size.h, size.w]);

  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of simEdges) {
      const s = endpointId(edge.source as never);
      const t = endpointId(edge.target as never);
      (map.get(s) ?? map.set(s, new Set()).get(s)!).add(t);
      (map.get(t) ?? map.set(t, new Set()).get(t)!).add(s);
    }
    return map;
  }, [simEdges]);

  const nodeById = useMemo(() => new Map(simNodes.map((node) => [node.id, node])), [simNodes]);

  const hoverCaption = useMemo(() => {
    if (!minimal) return null;
    if (hoveredEdge) {
      const [sourceId, targetId] = hoveredEdge.split("\0");
      const source = nodeById.get(sourceId);
      const target = nodeById.get(targetId);
      if (!source || !target) return null;
      return `${source.label} → ${target.label} · ${edgeKindLabel(
        simEdges.find(
          (edge) =>
            endpointId(edge.source as never) === sourceId &&
            endpointId(edge.target as never) === targetId,
        )?.kind,
      )}`;
    }
    if (hovered) {
      const node = nodeById.get(hovered);
      if (!node) return null;
      return `${node.label} · ${NODE_TYPE_LABEL[node.type]}`;
    }
    return null;
  }, [hovered, hoveredEdge, minimal, nodeById, simEdges]);

  if (!fetchRoot) {
    if (minimal) return null;
    return (
      <div className={cn("flex flex-col bg-background", embedded ? "min-h-0 h-full" : "absolute inset-0 z-10")}>
        <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
          Open a paper to view its link graph.
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col",
        minimal ? "reading-focus-inline-graph__panel h-full min-h-0 bg-reading" : "bg-background",
        !minimal && (embedded ? "min-h-0 h-full" : "absolute inset-0 z-10"),
      )}
    >
      {!minimal ? (
      <div className="flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div>
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            {scope === "local" ? "Local graph" : "Global graph"} · {filtered.nodes.length} nodes
          </h2>
          {filtered.focusId ? (
            <p className="truncate text-[11px] text-muted-foreground">Focus: {filtered.focusId}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <div className="inline-flex rounded-sm border border-border p-0.5">
            {(["local", "global"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={cn(
                  "rounded-sm px-2 py-0.5 capitalize",
                  scope === mode ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                )}
                onClick={() => setScope(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          {scope === "local" ? (
            <div className="inline-flex items-center gap-1 text-muted-foreground">
              <span>Depth</span>
              {[1, 2].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={cn(
                    "rounded-sm border border-border px-1.5 py-0.5",
                    depth === d ? "bg-accent text-accent-foreground" : "",
                  )}
                  onClick={() => setDepth(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          ) : null}
          {onClose ? (
            <button type="button" className="rounded-sm border border-border px-2 py-0.5" onClick={onClose}>
              Close
            </button>
          ) : null}
        </div>
      </div>
      ) : null}
      {error && !minimal ? (
        <div className="p-4 text-xs text-destructive">{error}</div>
      ) : (
        <div ref={containerRef} className="graph-canvas-host min-h-0 flex-1">
          {hoverCaption ? (
            <div className="graph-hover-caption" role="status" aria-live="polite">
              {hoverCaption}
            </div>
          ) : null}
          {loading && !minimal ? (
            <div className="flex h-full min-h-[200px] items-center justify-center text-xs text-muted-foreground">
              Loading graph…
            </div>
          ) : simNodes.length === 0 && !minimal ? (
            <div className="flex h-full min-h-[200px] items-center justify-center text-xs text-muted-foreground">
              No nodes in view
            </div>
          ) : simNodes.length > 0 ? (
            <svg
              ref={svgRef}
              width={size.w}
              height={size.h}
              viewBox={`0 0 ${size.w} ${size.h}`}
              className="block h-full w-full touch-none"
              role="img"
              aria-label="Semantic link graph"
            >
              <g ref={zoomLayerRef}>
                {simEdges.map((edge, index) => {
                  const s = edge.source as SimNode;
                  const t = edge.target as SimNode;
                  if (typeof s !== "object" || typeof t !== "object") return null;
                  const edgeKey = edgeHoverKey(s.id, t.id);
                  const edgeHovered = hoveredEdge === edgeKey;
                  const highlight =
                    edgeHovered ||
                    !hovered ||
                    hovered === s.id ||
                    hovered === t.id ||
                    (neighbors.get(hovered)?.has(s.id) && neighbors.get(hovered)?.has(t.id));
                  const edgeTitle = `${s.label} → ${t.label} · ${edgeKindLabel(edge.kind)}`;
                  return (
                    <g key={index}>
                      <line
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke="currentColor"
                        className={edge.kind === "contains" ? "text-muted-foreground" : "text-primary"}
                        strokeOpacity={highlight ? 0.55 : 0.2}
                        strokeWidth={edge.kind === "contains" ? 1 : highlight ? 1.75 : 1}
                        strokeDasharray={edge.kind === "contains" ? "4 3" : undefined}
                        pointerEvents="none"
                      />
                      <line
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke="transparent"
                        strokeWidth={14}
                        pointerEvents="stroke"
                        onMouseEnter={() => {
                          setHoveredEdge(edgeKey);
                          setHovered(null);
                        }}
                        onMouseLeave={() => setHoveredEdge(null)}
                      >
                        <title>{edgeTitle}</title>
                      </line>
                    </g>
                  );
                })}
                {simNodes.map((node) => {
                  const radius = (node.isFocus ? 10 : 7) + Math.min(node.links, 4);
                  const showLabel = !minimal && shouldShowLabel(node.id, hovered);
                  const dimmed = hovered !== null && hovered !== node.id && !neighbors.get(hovered)?.has(node.id);
                  const label =
                    node.label.length > 28 ? `${node.label.slice(0, 26).trimEnd()}…` : node.label;
                  const nodeTitle = `${node.label} · ${NODE_TYPE_LABEL[node.type]}`;
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x ?? 0},${node.y ?? 0})`}
                      style={{ cursor: "pointer", opacity: dimmed ? 0.35 : 1 }}
                      role="button"
                      tabIndex={0}
                      aria-label={nodeTitle}
                      onMouseEnter={() => {
                        setHovered(node.id);
                        setHoveredEdge(null);
                      }}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => {
                        setHovered(node.id);
                        setHoveredEdge(null);
                      }}
                      onBlur={() => setHovered(null)}
                      onClick={() => onSelectNode(node.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectNode(node.id);
                        }
                      }}
                    >
                      <title>{nodeTitle}</title>
                      {node.isFocus ? (
                        <circle
                          r={radius + 4}
                          fill="none"
                          stroke={graphColor(node.type)}
                          strokeOpacity={0.25}
                          strokeWidth={3}
                        />
                      ) : null}
                      <circle
                        r={radius}
                        fill={graphColor(node.type)}
                        stroke="hsl(var(--card))"
                        strokeWidth={node.type === "missing" ? 0 : 1.5}
                        strokeDasharray={node.type === "missing" ? "2 2" : undefined}
                      />
                      {showLabel ? (
                        <g style={{ pointerEvents: "none" }}>
                          <rect
                            x={-(label.length * 3.4 + 8) / 2}
                            y={-(radius + 24)}
                            width={label.length * 3.4 + 8}
                            height={18}
                            rx={4}
                            className="fill-card stroke-border"
                            strokeWidth={1}
                          />
                          <text
                            x={0}
                            y={-(radius + 11)}
                            textAnchor="middle"
                            fontSize={12}
                            fontWeight={500}
                            className="fill-foreground"
                          >
                            {label}
                          </text>
                        </g>
                      ) : null}
                    </g>
                  );
                })}
              </g>
            </svg>
          ) : null}
        </div>
      )}
    </div>
  );
}
