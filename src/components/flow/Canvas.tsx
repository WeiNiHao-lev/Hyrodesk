"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider,
  Edge, Node, Connection, NodeChange, applyNodeChanges, MarkerType, useReactFlow,
} from "@xyflow/react";
import { useStudy } from "@/lib/store/useStudy";
import { UNIT_BY_TYPE } from "@/lib/engine/units";
import { UnitNode } from "./UnitNode";

const nodeTypes = { unit: UnitNode };

function CanvasInner() {
  const {
    flowsheet, selectedId, result, select, addNode,
    updateNodePosition, connect, removeEdge, removeNode,
  } = useStudy();
  const wrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const nodes: Node[] = useMemo(
    () =>
      flowsheet.nodes.map((nd) => {
        const r = result?.nodes.find((x) => x.id === nd.id);
        const outFlow =
          r
            ? Object.values(r.outlets).reduce((a, s) => a + s.flow, 0) || r.inlet.flow
            : undefined;
        return {
          id: nd.id,
          type: "unit",
          position: nd.position,
          selected: nd.id === selectedId,
          data: {
            label: nd.label,
            unitType: nd.type,
            flow: r ? (UNIT_BY_TYPE[nd.type]?.outlets.length ? outFlow : r.inlet.flow) : undefined,
            tds: r ? r.inlet.c.TDS : undefined,
          },
        } as Node;
      }),
    [flowsheet.nodes, selectedId, result],
  );

  const edges: Edge[] = useMemo(
    () =>
      flowsheet.edges.map((e) => {
        const row = result?.streams.find((s) => s.id === e.id);
        return {
          id: e.id,
          source: e.source,
          sourceHandle: e.sourceHandle,
          target: e.target,
          targetHandle: "in",
          type: "smoothstep",
          animated: (row?.stream.flow ?? 0) > 0,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#7fb4d1", width: 16, height: 16 },
          label: row ? `${row.stream.flow.toFixed(1)}` : undefined,
          labelStyle: { fontSize: 10, fontWeight: 700, fill: "#24506f" },
          labelBgStyle: { fill: "#ffffff", fillOpacity: 0.85 },
          labelBgPadding: [3, 1] as [number, number],
          labelBgBorderRadius: 4,
        } as Edge;
      }),
    [flowsheet.edges, result],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const next = applyNodeChanges(changes, nodes);
      for (const c of changes) {
        if (c.type === "position" && c.position) {
          updateNodePosition(c.id, c.position);
        }
        if (c.type === "remove") removeNode(c.id);
      }
      void next;
    },
    [nodes, updateNodePosition, removeNode],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      connect(c.source, c.sourceHandle ?? "out", c.target);
    },
    [connect],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/hydrodesk-unit");
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(type, { x: Math.round(position.x), y: Math.round(position.y) });
    },
    [screenToFlowPosition, addNode],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        removeNode(selectedId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, removeNode]);

  return (
    <div ref={wrapper} className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onNodeClick={(_, nd) => select(nd.id)}
        onPaneClick={() => select(null)}
        onEdgeDoubleClick={(_, ed) => removeEdge(ed.id)}
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "smoothstep" }}
        minZoom={0.15}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#c3dcea" />
        <Controls
          showInteractive={false}
          className="!rounded-lg !border !border-ink-900/10 !bg-white/90 !shadow-sm"
        />
        <MiniMap
          pannable
          zoomable
          className="!rounded-lg !border !border-ink-900/10 !bg-white/85"
          nodeColor={() => "#74d7fb"}
          maskColor="rgba(246, 251, 254, 0.7)"
        />
      </ReactFlow>
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
