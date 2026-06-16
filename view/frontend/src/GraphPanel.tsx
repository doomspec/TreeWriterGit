import { useEffect, useMemo, useRef, useState } from "react";
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

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

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

const TYPE_COLOR: Record<GraphNodeType, string> = {
  paper: "#7c3aed",
  section: "#2563eb",
  unit: "#059669",
  note: "#d97706",
  doc: "#64748b",
  missing: "#dc2626",
};

function endpointId(value: string | number | SimNode): string {
  return typeof value === "object" ? value.id : String(value);
}

export function GraphPanel({
  root,
  onSelectNode,
  onClose,
  embedded = false,
}: {
  root: string;
  onSelectNode: (id: string) => void;
  onClose?: () => void;
  embedded?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 480, h: 360 });
  const [rawNodes, setRawNodes] = useState<RawNode[]>([]);
  const [rawEdges, setRawEdges] = useState<RawEdge[]>([]);
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simEdges, setSimEdges] = useState<SimEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [scope, setScope] = useState<GraphScope>("local");
  const [depth, setDepth] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 480, height: 360 };
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${apiBaseUrl}/api/model/graph?root=${encodeURIComponent(root)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Graph load failed (${response.status})`);
        return (await response.json()) as { nodes: RawNode[]; edges: RawEdge[] };
      })
      .then((data) => {
        if (cancelled) return;
        setRawNodes(data.nodes);
        setRawEdges(data.edges);
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
  }, [root]);

  const focusId = useMemo(() => resolveFocusId(rawNodes, root), [rawNodes, root]);

  const filtered = useMemo(
    () => filterLocalGraph(rawNodes, rawEdges, focusId, depth, scope),
    [rawNodes, rawEdges, focusId, depth, scope],
  );

  useEffect(() => {
    if (loading || filtered.nodes.length === 0) {
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
      );

    simulation.on("tick", () => {
      setSimNodes([...nodes]);
      setSimEdges([...edges]);
    });

    for (let i = 0; i < 180; i += 1) simulation.tick();
    setSimNodes([...nodes]);
    setSimEdges([...edges]);

    return () => {
      simulation.stop();
    };
  }, [filtered, loading, size.h, size.w]);

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

  const focusNeighbors = filtered.focusId ? (neighbors.get(filtered.focusId) ?? new Set<string>()) : new Set<string>();

  return (
    <div className={cn("flex flex-col bg-background", embedded ? "min-h-0 h-full" : "absolute inset-0 z-10")}>
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
      {error ? (
        <div className="p-4 text-xs text-destructive">{error}</div>
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Loading graph…</div>
      ) : simNodes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">No nodes in view</div>
      ) : (
        <div ref={containerRef} className="graph-canvas-host min-h-0 flex-1">
          <svg width={size.w} height={size.h} className="block h-full w-full" role="img">
            {simEdges.map((edge, index) => {
              const s = edge.source as SimNode;
              const t = edge.target as SimNode;
              if (typeof s !== "object" || typeof t !== "object") return null;
              const highlight =
                !hovered ||
                hovered === s.id ||
                hovered === t.id ||
                (neighbors.get(hovered)?.has(s.id) && neighbors.get(hovered)?.has(t.id));
              return (
                <line
                  key={index}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke="currentColor"
                  className={edge.kind === "contains" ? "text-muted-foreground" : "text-primary"}
                  strokeOpacity={highlight ? 0.55 : 0.2}
                  strokeWidth={edge.kind === "contains" ? 1 : highlight ? 1.75 : 1}
                  strokeDasharray={edge.kind === "contains" ? "4 3" : undefined}
                />
              );
            })}
            {simNodes.map((node) => {
              const radius = (node.isFocus ? 10 : 7) + Math.min(node.links, 4);
              const showLabel = shouldShowLabel(node.id, filtered.focusId, focusNeighbors, hovered);
              const dimmed = hovered !== null && hovered !== node.id && !neighbors.get(hovered)?.has(node.id);
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x ?? 0},${node.y ?? 0})`}
                  style={{ cursor: "pointer", opacity: dimmed ? 0.35 : 1 }}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onSelectNode(node.id)}
                >
                  {node.isFocus ? (
                    <circle r={radius + 4} fill="none" stroke={TYPE_COLOR[node.type]} strokeOpacity={0.25} strokeWidth={3} />
                  ) : null}
                  <circle
                    r={radius}
                    fill={TYPE_COLOR[node.type]}
                    stroke="white"
                    strokeWidth={node.type === "missing" ? 0 : 1.5}
                    strokeDasharray={node.type === "missing" ? "2 2" : undefined}
                  />
                  {showLabel ? (
                    <text
                      x={radius + 4}
                      y={4}
                      fontSize={11}
                      fontWeight={node.isFocus ? 600 : 400}
                      className="fill-foreground"
                      style={{ pointerEvents: "none" }}
                    >
                      {node.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
