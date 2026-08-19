"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  type Node as RFNode,
  type Edge as RFEdge,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { buildOrgChartTree, type OrgChartUser } from "@/lib/orgChart/buildTree";
import { buildFlowGraph, type FlowNodeData } from "@/lib/orgChart/toFlow";
import { layoutFlowGraph } from "@/lib/orgChart/layout";
import { EmployeeNode, type EmployeeNodeData, type EmployeeNodeAdminActions } from "./EmployeeNode";
import {
  AUTO_COLLAPSE_THRESHOLD,
  CARD_HEIGHT_DESKTOP,
  CARD_HEIGHT_MOBILE,
  CARD_WIDTH,
  MINIMAP_THRESHOLD,
  MOBILE_BREAKPOINT_PX,
} from "./constants";

const NODE_TYPES = { employee: EmployeeNode };

export type OrgChartCanvasApi = {
  focusNode: (id: string) => void;
  setCollapseLevel: (level: number | null) => void;
  fitAll: () => void;
};

function buildChildrenIndex(flowNodes: FlowNodeData[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const n of flowNodes) {
    if (!n.parentId) continue;
    const siblings = index.get(n.parentId) ?? [];
    siblings.push(n.id);
    index.set(n.parentId, siblings);
  }
  return index;
}

function computeVisibleIds(flowNodes: FlowNodeData[], childrenIndex: Map<string, string[]>, collapsed: Set<string>): Set<string> {
  const visible = new Set<string>();
  const roots = flowNodes.filter((n) => !n.parentId);
  const queue = [...roots.map((n) => n.id)];
  while (queue.length > 0) {
    const id = queue.shift()!;
    visible.add(id);
    if (collapsed.has(id)) continue;
    for (const childId of childrenIndex.get(id) ?? []) queue.push(childId);
  }
  return visible;
}

function computeInitialCollapse(flowNodes: FlowNodeData[]): Set<string> {
  if (flowNodes.length <= AUTO_COLLAPSE_THRESHOLD) return new Set();
  return new Set(flowNodes.filter((n) => n.depth === 1 && n.descendantCount > 0).map((n) => n.id));
}

function collectAncestorIds(byId: Map<string, FlowNodeData>, id: string): string[] {
  const ancestors: string[] = [];
  let current = byId.get(id);
  while (current?.parentId) {
    ancestors.push(current.parentId);
    current = byId.get(current.parentId);
  }
  return ancestors;
}

// Every id transitively under `id` (not including `id` itself) — used to
// reject a reparent drop onto one of the dragged node's own reports, which
// would otherwise create a cycle.
function collectDescendantIds(childrenIndex: Map<string, string[]>, id: string): Set<string> {
  const descendants = new Set<string>();
  const queue = [...(childrenIndex.get(id) ?? [])];
  while (queue.length > 0) {
    const childId = queue.shift()!;
    if (descendants.has(childId)) continue;
    descendants.add(childId);
    for (const grandchildId of childrenIndex.get(childId) ?? []) queue.push(grandchildId);
  }
  return descendants;
}

function OrgChartCanvasInner({
  nodes,
  onReady,
  linkToProfile = true,
  editMode = false,
  adminActions,
  onReorderSiblings,
  onRequestReparent,
}: {
  nodes: OrgChartUser[];
  onReady?: (api: OrgChartCanvasApi) => void;
  linkToProfile?: boolean;
  editMode?: boolean;
  adminActions?: EmployeeNodeAdminActions;
  onReorderSiblings?: (managerId: string | null, orderedUserIds: string[]) => Promise<void>;
  onRequestReparent?: (employeeId: string, newManagerId: string) => void;
}) {
  const rf = useReactFlow();
  // The page only mounts this component once `nodes` is already non-empty
  // (see app/(dashboard)/org-chart/page.tsx), so this lazy initializer runs
  // exactly once against real data — later prop updates (realtime refresh)
  // don't reset the user's collapse state.
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(() =>
    computeInitialCollapse(buildFlowGraph(buildOrgChartTree(nodes)).nodes),
  );
  const [isMobile, setIsMobile] = useState(false);
  const [centerRequest, setCenterRequest] = useState<{ id: string; nonce: number; duration: number } | null>(null);
  const centerNonce = useRef(0);
  const processedCenterNonce = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const flowGraph = useMemo(() => buildFlowGraph(buildOrgChartTree(nodes)), [nodes]);
  const flowNodesById = useMemo(() => new Map(flowGraph.nodes.map((n) => [n.id, n])), [flowGraph]);
  const childrenIndex = useMemo(() => buildChildrenIndex(flowGraph.nodes), [flowGraph]);

  const visibleNodeIds = useMemo(
    () => computeVisibleIds(flowGraph.nodes, childrenIndex, collapsedNodeIds),
    [flowGraph, childrenIndex, collapsedNodeIds],
  );

  const dimensions = useMemo(
    () => ({ width: CARD_WIDTH, height: isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT_DESKTOP }),
    [isMobile],
  );

  const layout = useMemo(
    () => layoutFlowGraph(flowGraph.nodes, flowGraph.edges, visibleNodeIds, dimensions),
    [flowGraph, visibleNodeIds, dimensions],
  );

  const requestCenter = useCallback((id: string, duration: number) => {
    centerNonce.current += 1;
    setCenterRequest({ id, nonce: centerNonce.current, duration });
  }, []);

  const toggleCollapse = useCallback(
    (id: string) => {
      setCollapsedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      requestCenter(id, 300);
    },
    [requestCenter],
  );

  const rfNodes: RFNode<EmployeeNodeData, "employee">[] = useMemo(
    () =>
      flowGraph.nodes
        .filter((n) => visibleNodeIds.has(n.id))
        .map((n) => {
          const pos = layout.positions.get(n.id) ?? { x: 0, y: 0 };
          return {
            id: n.id,
            type: "employee" as const,
            position: pos,
            width: dimensions.width,
            height: dimensions.height,
            style: { width: dimensions.width, height: dimensions.height },
            draggable: editMode,
            connectable: false,
            selectable: false,
            data: {
              user: n.user,
              descendantCount: n.descendantCount,
              hasChildren: n.descendantCount > 0,
              collapsed: collapsedNodeIds.has(n.id),
              hasParent: !!n.parentId,
              onToggleCollapse: toggleCollapse,
              linkToProfile,
              adminActions: editMode ? adminActions : undefined,
              additionalManagerNames: n.user.additionalManagers
                .map((m) => {
                  const manager = flowNodesById.get(m.managerId);
                  return manager ? { name: manager.user.displayName, relationshipType: m.relationshipType } : null;
                })
                .filter((m): m is { name: string; relationshipType: string } => m !== null),
            },
          };
        }),
    [flowGraph, visibleNodeIds, layout, dimensions, collapsedNodeIds, toggleCollapse, linkToProfile, editMode, adminActions, flowNodesById],
  );

  // Kept in sync after every render so onNodeDragStop can force an
  // immediate resync to the layout-computed positions without waiting for a
  // prop round-trip — React Flow's drag interaction updates its own
  // internal node store independently of the controlled `nodes` prop, so an
  // invalid or pending-confirmation drop needs an explicit nudge to snap
  // back instead of staying at the raw dropped pixel position.
  const latestRfNodesRef = useRef(rfNodes);
  useEffect(() => {
    latestRfNodesRef.current = rfNodes;
  }, [rfNodes]);

  const snapBack = useCallback(() => {
    rf.setNodes(latestRfNodesRef.current);
  }, [rf]);

  const onNodeDragStop: OnNodeDrag<RFNode<EmployeeNodeData, "employee">> = useCallback(
    (_event, draggedNode) => {
      const draggedFlowNode = flowNodesById.get(draggedNode.id);
      if (!draggedFlowNode) return snapBack();

      const hits = rf
        .getIntersectingNodes(draggedNode)
        .filter((n): n is RFNode<EmployeeNodeData, "employee"> => n.id !== draggedNode.id);

      if (hits.length === 0) return snapBack();

      const draggedDescendants = collectDescendantIds(childrenIndex, draggedNode.id);
      const validHits = hits.filter((n) => !draggedDescendants.has(n.id));
      if (validHits.length === 0) return snapBack();

      // Largest-overlap hit wins when the drop is ambiguous between two
      // nearby cards.
      const draggedRect = { x: draggedNode.position.x, y: draggedNode.position.y, width: dimensions.width, height: dimensions.height };
      const target = validHits.reduce((best, candidate) => {
        const overlap = (n: RFNode<EmployeeNodeData, "employee">) => {
          const x = Math.max(0, Math.min(draggedRect.x + draggedRect.width, n.position.x + dimensions.width) - Math.max(draggedRect.x, n.position.x));
          const y = Math.max(0, Math.min(draggedRect.y + draggedRect.height, n.position.y + dimensions.height) - Math.max(draggedRect.y, n.position.y));
          return x * y;
        };
        return overlap(candidate) > overlap(best) ? candidate : best;
      }, validHits[0]);

      const targetFlowNode = flowNodesById.get(target.id);
      if (!targetFlowNode) return snapBack();

      if (targetFlowNode.parentId === draggedFlowNode.parentId) {
        // Reorder among true siblings — remove the dragged node from its old
        // slot and reinsert it before/after the target based on drop side.
        const siblingIds = (draggedFlowNode.parentId ? childrenIndex.get(draggedFlowNode.parentId) : flowGraph.nodes.filter((n) => !n.parentId).map((n) => n.id)) ?? [];
        const withoutDragged = siblingIds.filter((id) => id !== draggedNode.id);
        const targetIndex = withoutDragged.indexOf(target.id);
        const insertAfter = draggedNode.position.x > target.position.x;
        const insertAt = insertAfter ? targetIndex + 1 : targetIndex;
        const newOrder = [...withoutDragged.slice(0, insertAt), draggedNode.id, ...withoutDragged.slice(insertAt)];

        onReorderSiblings?.(draggedFlowNode.parentId, newOrder);
      } else {
        // Different parent: dropped directly onto a card means "become a
        // direct report of that card" — never auto-saved, the page opens a
        // confirmation before this actually persists.
        onRequestReparent?.(draggedNode.id, target.id);
      }

      snapBack();
    },
    [rf, flowNodesById, childrenIndex, flowGraph, dimensions, onReorderSiblings, onRequestReparent, snapBack],
  );

  const rfEdges: RFEdge[] = useMemo(
    () =>
      flowGraph.edges
        .filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
        .map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: "smoothstep",
          // Secondary (additional-relationship) edges get a distinct violet
          // dash so they're never confused with a dashed PRIMARY line (the
          // existing "support" case on the sole managerId edge) — both would
          // otherwise render identically gray-dashed.
          style: e.secondary
            ? { strokeDasharray: "4 4", stroke: "#a78bfa", strokeWidth: 1.5 }
            : e.dashed
              ? { strokeDasharray: "6 4", stroke: "#9ca3af" }
              : { stroke: "#cbd5e0" },
          zIndex: e.secondary ? 0 : 1,
        })),
    [flowGraph, visibleNodeIds],
  );

  // Recenter on a toggled/searched node once its layout position is ready —
  // used for both collapse-toggle recentering (never a full re-fit, so the
  // user's navigation context survives an expand/collapse) and search-driven
  // focus (ancestors are expanded first in focusNode below, then this effect
  // centers on the target once that layout is available). Idempotency is
  // tracked via a ref (not state) so this never calls setState itself.
  useEffect(() => {
    if (!centerRequest || processedCenterNonce.current === centerRequest.nonce) return;
    const pos = layout.positions.get(centerRequest.id);
    if (!pos) return;
    processedCenterNonce.current = centerRequest.nonce;
    rf.setCenter(pos.x + dimensions.width / 2, pos.y + dimensions.height / 2, {
      zoom: Math.max(rf.getZoom(), 0.6),
      duration: centerRequest.duration,
    });
  }, [centerRequest, layout, dimensions, rf]);

  const focusNode = useCallback(
    (id: string) => {
      const ancestors = collectAncestorIds(flowNodesById, id);
      if (ancestors.length > 0) {
        setCollapsedNodeIds((prev) => {
          let changed = false;
          const next = new Set(prev);
          for (const ancestorId of ancestors) {
            if (next.delete(ancestorId)) changed = true;
          }
          return changed ? next : prev;
        });
      }
      requestCenter(id, 500);
    },
    [flowNodesById, requestCenter],
  );

  const setCollapseLevel = useCallback(
    (level: number | null) => {
      if (level === null) {
        setCollapsedNodeIds(new Set());
        return;
      }
      const targetDepth = level - 1;
      setCollapsedNodeIds(
        new Set(flowGraph.nodes.filter((n) => n.depth === targetDepth && n.descendantCount > 0).map((n) => n.id)),
      );
    },
    [flowGraph],
  );

  const fitAll = useCallback(() => {
    rf.fitView({ padding: 0.2, duration: 400 });
  }, [rf]);

  useEffect(() => {
    onReady?.({ focusNode, setCollapseLevel, fitAll });
  }, [onReady, focusNode, setCollapseLevel, fitAll]);

  const showMiniMap = flowGraph.nodes.length > MINIMAP_THRESHOLD;

  return (
    <div className="w-full h-[70vh] min-h-[420px] overflow-hidden">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        nodesDraggable={editMode}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeDragStop={editMode ? onNodeDragStop : undefined}
        minZoom={0.15}
        maxZoom={1.5}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} className="opacity-40" />
        <Controls showInteractive={false} position="bottom-right" className="!shadow-sm !border !border-table-border !rounded-lg [&_button]:!min-w-[32px] [&_button]:!min-h-[32px]" />
        {showMiniMap && (
          <MiniMap
            pannable={false}
            zoomable={false}
            className="hidden md:block !border !border-table-border !rounded-lg"
          />
        )}
      </ReactFlow>
    </div>
  );
}

export function OrgChartCanvas(props: {
  nodes: OrgChartUser[];
  onReady?: (api: OrgChartCanvasApi) => void;
  linkToProfile?: boolean;
  editMode?: boolean;
  adminActions?: EmployeeNodeAdminActions;
  onReorderSiblings?: (managerId: string | null, orderedUserIds: string[]) => Promise<void>;
  onRequestReparent?: (employeeId: string, newManagerId: string) => void;
}) {
  return (
    <ReactFlowProvider>
      <OrgChartCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
