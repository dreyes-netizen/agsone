import type { OrgChartTreeEntry, OrgChartUser } from "./buildTree";

export type FlowNodeData = {
  id: string;
  user: OrgChartUser;
  parentId: string | null;
  depth: number;
  /**
   * Total recursive descendant count (every level below this node), not just
   * direct reports. This is the one number shown on the collapse toggle
   * (EmployeeNode) and used everywhere collapse eligibility/targeting is
   * decided (computeInitialCollapse, setCollapseLevel in OrgChartCanvas) —
   * keep it that way everywhere rather than mixing in a direct-report count.
   * It's derived once from the full, uncollapsed tree, so it stays accurate
   * even while some of those descendants are currently hidden by a collapse.
   */
  descendantCount: number;
};

export type FlowEdgeData = {
  id: string;
  source: string;
  target: string;
  /** Support/dotted-line reporting relationship — derived from the child's `orgChartDashed` flag. */
  dashed: boolean;
};

export type FlowGraph = {
  nodes: FlowNodeData[];
  edges: FlowEdgeData[];
  depthById: Map<string, number>;
  descendantCountById: Map<string, number>;
};

function countDescendants(entry: OrgChartTreeEntry): number {
  return entry.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

// Flattens the hierarchy forest into React-Flow-agnostic node/edge lists plus
// per-id depth and descendant-count lookups, in a single pass. Kept free of
// any @xyflow/react import so it stays trivially unit-testable.
export function buildFlowGraph(roots: OrgChartTreeEntry[]): FlowGraph {
  const nodes: FlowNodeData[] = [];
  const edges: FlowEdgeData[] = [];
  const depthById = new Map<string, number>();
  const descendantCountById = new Map<string, number>();

  function visit(entry: OrgChartTreeEntry, parentId: string | null, depth: number) {
    const id = entry.node.id;
    const descendantCount = countDescendants(entry);
    depthById.set(id, depth);
    descendantCountById.set(id, descendantCount);
    nodes.push({ id, user: entry.node, parentId, depth, descendantCount });

    if (parentId) {
      edges.push({ id: `${parentId}->${id}`, source: parentId, target: id, dashed: entry.node.orgChartDashed });
    }

    for (const child of entry.children) visit(child, id, depth + 1);
  }

  for (const root of roots) visit(root, null, 0);

  return { nodes, edges, depthById, descendantCountById };
}
