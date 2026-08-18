import { Graph, layout } from "@dagrejs/dagre";
import type { FlowEdgeData, FlowNodeData } from "./toFlow";

export type NodeDimensions = { width: number; height: number };

export type LayoutResult = {
  positions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
};

const DEFAULT_RANKSEP = 80;
const DEFAULT_NODESEP = 40;
const DEFAULT_EDGESEP = 20;

// Lays out only the visible subgraph with Dagre (top-to-bottom) and converts
// its center-point coordinates to React Flow's top-left convention. Hidden
// (collapsed) nodes/edges never enter the graph at all, so collapsing a
// branch actually compacts the remaining layout rather than leaving a gap.
export function layoutFlowGraph(
  nodes: FlowNodeData[],
  edges: FlowEdgeData[],
  visibleIds: Set<string>,
  dimensions: NodeDimensions,
): LayoutResult {
  const g = new Graph();
  g.setGraph({ rankdir: "TB", ranksep: DEFAULT_RANKSEP, nodesep: DEFAULT_NODESEP, edgesep: DEFAULT_EDGESEP });
  g.setDefaultEdgeLabel(() => ({}));

  const depthById = new Map<string, number>();
  const childrenByParent = new Map<string, string[]>();

  for (const n of nodes) {
    if (!visibleIds.has(n.id)) continue;
    g.setNode(n.id, { width: dimensions.width, height: dimensions.height });
    depthById.set(n.id, n.depth);
  }
  for (const e of edges) {
    if (!visibleIds.has(e.source) || !visibleIds.has(e.target)) continue;
    g.setEdge(e.source, e.target);
    // `edges` lists a parent's children in persisted admin order (each
    // child's own edge is pushed the moment buildFlowGraph visits it, in a
    // pre-order DFS over buildOrgChartTree's already-sortOrder-sorted tree),
    // so `childrenByParent.get(parentId)` comes out pre-sorted for free.
    const siblings = childrenByParent.get(e.source) ?? [];
    siblings.push(e.target);
    childrenByParent.set(e.source, siblings);
  }

  layout(g);

  // Moves `id` and everything transitively under it by the same delta, so
  // repositioning a sibling that itself has descendants carries its whole
  // (already-positioned) subtree along rather than orphaning it.
  function shiftSubtree(id: string, dx: number) {
    if (dx === 0) return;
    g.node(id).x += dx;
    for (const childId of childrenByParent.get(id) ?? []) shiftSubtree(childId, dx);
  }

  // The horizontal span of `id`'s own subtree, bottoming out at leaves
  // rather than including an intermediate parent's own (not yet centered)
  // x: dagre's crossing-minimization can place a parent far from its own
  // children when ITS siblings pull its median position away, which would
  // otherwise inflate this subtree's apparent width well past what its
  // actual content needs.
  function subtreeExtent(id: string): [number, number] {
    const children = childrenByParent.get(id);
    if (!children || children.length === 0) {
      const x = g.node(id).x;
      return [x, x];
    }
    let min = Infinity;
    let max = -Infinity;
    for (const childId of children) {
      const [childMin, childMax] = subtreeExtent(childId);
      min = Math.min(min, childMin);
      max = Math.max(max, childMax);
    }
    return [min, max];
  }

  // Dagre's crossing-minimization pass can silently reorder same-rank
  // siblings regardless of input order, and simply relabeling x-values
  // between siblings (swapping which dagre-assigned point each one gets)
  // breaks down as soon as their subtrees have different widths — a manager
  // with many reports next to one with none would get its wide subtree
  // dragged into a slot only sized for a single node, overlapping whatever
  // ends up next to it. Instead, treat each sibling as a block sized to its
  // own subtree's actual width and pack the blocks left-to-right in
  // persisted order, keeping the group's overall center where dagre
  // originally placed it (so packing doesn't drift the whole tree sideways,
  // only reorders within it).
  function packSiblings(orderedIds: string[]) {
    if (orderedIds.length < 2) return;
    const extents = orderedIds.map(subtreeExtent);
    const blockWidths = extents.map(([min, max]) => max - min + dimensions.width);
    const totalWidth = blockWidths.reduce((a, b) => a + b, 0) + DEFAULT_NODESEP * (orderedIds.length - 1);
    const overallMin = Math.min(...extents.map(([min]) => min)) - dimensions.width / 2;
    const overallMax = Math.max(...extents.map(([, max]) => max)) + dimensions.width / 2;
    let cursor = (overallMin + overallMax) / 2 - totalWidth / 2;
    orderedIds.forEach((id, i) => {
      const trueLeftEdge = extents[i][0] - dimensions.width / 2;
      shiftSubtree(id, cursor - trueLeftEdge);
      cursor += blockWidths[i] + DEFAULT_NODESEP;
    });
  }

  // Pack every sibling group top-down (shallowest rank first): a shallow
  // group's pack step shifts each member's whole (not-yet-internally-
  // repacked) subtree by a uniform delta, which doesn't disturb the
  // relative spacing that subtree's own pack step reads next when the loop
  // reaches it. Packing bottom-up instead would let a deeper rank's already
  //-fixed spacing get silently discarded by a shallower rank's pack step
  // reading a not-yet-centered parent position (see subtreeExtent above).
  const rootIds = nodes.filter((n) => visibleIds.has(n.id) && !n.parentId).map((n) => n.id);
  packSiblings(rootIds);
  const idsByDepthAsc = [...visibleIds].sort((a, b) => (depthById.get(a) ?? 0) - (depthById.get(b) ?? 0));
  for (const id of idsByDepthAsc) {
    const children = childrenByParent.get(id);
    if (children) packSiblings(children);
  }

  // Dagre's median/barycenter heuristic optimizes overall edge straightness
  // across the whole graph, not "each parent centered over its own visible
  // children" — as soon as sibling subtrees are asymmetric in size, the
  // parent visibly drifts off-center from its direct-reports row. Re-center
  // every parent over the midpoint of its own (now correctly packed)
  // children, deepest rank first, in a SEPARATE bottom-up pass — this only
  // ever reassigns a single parent's own x (never shifts a subtree), so it
  // can't undo the packing pass above, and each correction always uses its
  // children's final x rather than a not-yet-corrected ancestor's.
  const idsByDepthDesc = [...visibleIds].sort((a, b) => (depthById.get(b) ?? 0) - (depthById.get(a) ?? 0));
  for (const id of idsByDepthDesc) {
    const children = childrenByParent.get(id);
    if (!children || children.length === 0) continue;
    const childXs = children.map((childId) => g.node(childId).x);
    g.node(id).x = (Math.min(...childXs) + Math.max(...childXs)) / 2;
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const id of g.nodes()) {
    const { x, y } = g.node(id);
    positions.set(id, { x: x - dimensions.width / 2, y: y - dimensions.height / 2 });
  }

  const graphLabel = g.graph() ?? {};
  return { positions, width: graphLabel.width ?? 0, height: graphLabel.height ?? 0 };
}
