import { useEffect, useMemo, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum
} from "d3-force";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

const WIDTH = 1000;
const HEIGHT = 680;

type GraphNodeType = "paper" | "section" | "unit" | "note" | "missing" | "doc";

interface RawNode {
  id: string;
  label: string;
  type: GraphNodeType;
  links: number;
}
interface RawEdge {
  source: string;
  target: string;
}

type SimNode = RawNode & SimulationNodeDatum;
type SimEdge = SimulationLinkDatum<SimNode>;

const TYPE_COLOR: Record<GraphNodeType, string> = {
  paper: "#7c3aed",
  section: "#2563eb",
  unit: "#059669",
  note: "#d97706",
  doc: "#64748b",
  missing: "#dc2626"
};

function endpointId(value: string | number | SimNode): string {
  return typeof value === "object" ? value.id : String(value);
}

export function GraphPanel({
  root,
  onSelectNode,
  onClose
}: {
  root: string;
  onSelectNode: (id: string) => void;
  onClose: () => void;
}) {
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [edges, setEdges] = useState<SimEdge[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBaseUrl}/api/model/graph?root=${encodeURIComponent(root)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Graph load failed (${response.status})`);
        return (await response.json()) as { nodes: RawNode[]; edges: RawEdge[] };
      })
      .then((data) => {
        if (cancelled) return;
        const simNodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
        const simEdges: SimEdge[] = data.edges.map((e) => ({ source: e.source, target: e.target }));
        const simulation = forceSimulation(simNodes)
          .force("link", forceLink<SimNode, SimEdge>(simEdges).id((d) => d.id).distance(70))
          .force("charge", forceManyBody().strength(-260))
          .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
          .force("collide", forceCollide<SimNode>((d) => 12 + Math.min(d.links, 6) * 2))
          .stop();
        for (let i = 0; i < 320; i += 1) simulation.tick();
        setNodes(simNodes);
        setEdges(simEdges);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
      });
    return () => {
      cancelled = true;
    };
  }, [root]);

  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of edges) {
      const s = endpointId(edge.source as never);
      const t = endpointId(edge.target as never);
      (map.get(s) ?? map.set(s, new Set()).get(s)!).add(t);
      (map.get(t) ?? map.set(t, new Set()).get(t)!).add(s);
    }
    return map;
  }, [edges]);

  const isActive = (id: string): boolean =>
    !hovered || hovered === id || (neighbors.get(hovered)?.has(id) ?? false);

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-xs font-semibold uppercase text-muted-foreground">
          Graph · {root || "model"} · {nodes.length} nodes
        </h2>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {(["paper", "section", "unit", "note", "missing"] as const).map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TYPE_COLOR[t] }} />
              {t}
            </span>
          ))}
          <button type="button" className="rounded-sm border border-border px-2 py-0.5" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      {error ? (
        <div className="p-4 text-xs text-destructive">{error}</div>
      ) : (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="min-h-0 w-full flex-1" role="img">
          {edges.map((edge, index) => {
            const s = edge.source as SimNode;
            const t = edge.target as SimNode;
            if (typeof s !== "object" || typeof t !== "object") return null;
            const active = isActive(s.id) && isActive(t.id);
            return (
              <line
                key={index}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke="currentColor"
                className="text-border"
                strokeOpacity={active ? 0.7 : 0.12}
                strokeWidth={1}
              />
            );
          })}
          {nodes.map((node) => {
            const radius = 5 + Math.min(node.links, 8) * 1.6;
            const active = isActive(node.id);
            return (
              <g
                key={node.id}
                transform={`translate(${node.x ?? 0},${node.y ?? 0})`}
                style={{ cursor: "pointer", opacity: active ? 1 : 0.25 }}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelectNode(node.id)}
              >
                <circle
                  r={radius}
                  fill={TYPE_COLOR[node.type]}
                  stroke="white"
                  strokeWidth={node.type === "missing" ? 0 : 1}
                  strokeDasharray={node.type === "missing" ? "2 2" : undefined}
                />
                <text
                  x={radius + 3}
                  y={3}
                  fontSize={10}
                  className="fill-foreground"
                  style={{ pointerEvents: "none" }}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
