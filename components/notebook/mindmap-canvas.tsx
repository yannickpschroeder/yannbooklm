"use client"

import { useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
  MarkerType,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react"
import dagre from "@dagrejs/dagre"
import "@xyflow/react/dist/style.css"
import type { MindmapData } from "@/app/api/studio/mindmap/route"

// ─── Dagre layout ─────────────────────────────────────────────────────────────

function applyDagreLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: "LR", ranksep: 80, nodesep: 40 })
  g.setDefaultEdgeLabel(() => ({}))

  nodes.forEach((n) => g.setNode(n.id, { width: 160, height: 48 }))
  edges.forEach((e) => g.setEdge(e.source, e.target))

  dagre.layout(g)

  return {
    nodes: nodes.map((n) => {
      const pos = g.node(n.id)
      return { ...n, position: { x: pos.x - 80, y: pos.y - 24 } }
    }),
    edges,
  }
}

// ─── Custom node ──────────────────────────────────────────────────────────────

type MindmapNodeData = { label: string; description?: string; group?: string; clickable?: boolean }

function MindmapNode({ data }: { data: MindmapNodeData }) {
  return (
    <div
      className={`group relative flex min-w-[120px] max-w-[160px] items-center justify-center rounded-xl border-2 border-blue-400/60 bg-blue-50/80 px-3 py-2 text-center text-[11px] font-medium leading-tight shadow-sm transition-shadow hover:shadow-md ${data.clickable ? "cursor-pointer hover:border-blue-500 hover:bg-blue-100/80" : ""}`}
      title={data.description ?? data.label}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-blue-400/50" />
      <span className="text-gray-800">{data.label}</span>
      <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-blue-400/50" />
      {data.description && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-48 -translate-x-1/2 rounded-lg border bg-white px-3 py-2 text-left text-[10px] leading-relaxed text-gray-600 shadow-xl group-hover:block">
          {data.description}
        </div>
      )}
    </div>
  )
}

const nodeTypes = { mindmap: MindmapNode }

// ─── Export helper ────────────────────────────────────────────────────────────

function ExportButton() {
  const { getNodes } = useReactFlow()

  async function handleExport() {
    const viewport = document.querySelector(".react-flow__viewport") as SVGGElement | null
    if (!viewport) return

    const svgEl = viewport.closest("svg") ?? viewport.ownerSVGElement
    if (!svgEl) return

    const svgClone = svgEl.cloneNode(true) as SVGElement
    svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg")

    const blob = new Blob([svgClone.outerHTML], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "mindmap.svg"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      className="absolute bottom-3 right-3 z-10 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow hover:bg-gray-50"
    >
      SVG exportieren
    </button>
  )
}

// ─── Inner canvas (needs ReactFlowProvider) ───────────────────────────────────

function MindmapCanvasInner({
  data,
  onNodeClick,
}: {
  data: MindmapData
  onNodeClick?: (label: string, parentLabel: string | null) => void
}) {
  const rootIds = useMemo(() => {
    const hasIncoming = new Set(data.edges.map((e) => e.target))
    return new Set(data.nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id))
  }, [data.edges, data.nodes])

  const rawNodes: Node[] = useMemo(
    () =>
      data.nodes.map((n) => ({
        id: n.id,
        type: "mindmap",
        position: { x: 0, y: 0 },
        data: {
          label: n.label,
          description: n.description,
          group: n.group,
          clickable: onNodeClick ? !rootIds.has(n.id) : false,
        },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.nodes, rootIds, !!onNodeClick]
  )

  const rawEdges: Edge[] = useMemo(
    () =>
      data.edges.map((e, i) => ({
        id: `e${i}`,
        source: e.source,
        target: e.target,
        label: e.label,
        labelStyle: { fontSize: 9, fill: "#6b7280" },
        labelBgStyle: { fill: "white", fillOpacity: 0.85 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "#93c5fd" },
        style: { stroke: "#93c5fd", strokeWidth: 1.5 },
        animated: false,
      })),
    [data.edges]
  )

  const { nodes: laidOutNodes, edges: laidOutEdges } = useMemo(
    () => applyDagreLayout(rawNodes, rawEdges),
    [rawNodes, rawEdges]
  )

  const [nodes, , onNodesChange] = useNodesState(laidOutNodes)
  const [edges, , onEdgesChange] = useEdgesState(laidOutEdges)

  function handleNodeClick(_: React.MouseEvent, node: Node) {
    if (!onNodeClick || rootIds.has(node.id)) return
    const parentEdge = data.edges.find((e) => e.target === node.id)
    const parentNode = parentEdge ? data.nodes.find((n) => n.id === parentEdge.source) : null
    onNodeClick((node.data as MindmapNodeData).label, parentNode?.label ?? null)
  }

  return (
    <div className="relative size-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor="#93c5fd"
          maskColor="rgba(0,0,0,0.05)"
          className="!bottom-12 !right-3"
        />
      </ReactFlow>
      <ExportButton />
    </div>
  )
}

// ─── Public export ────────────────────────────────────────────────────────────

export function MindmapCanvas({
  data,
  onNodeClick,
}: {
  data: MindmapData
  onNodeClick?: (label: string, parentLabel: string | null) => void
}) {
  return (
    <ReactFlowProvider>
      <MindmapCanvasInner data={data} onNodeClick={onNodeClick} />
    </ReactFlowProvider>
  )
}
