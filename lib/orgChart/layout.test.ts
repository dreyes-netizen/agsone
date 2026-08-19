import { describe, it, expect } from "vitest";
import { layoutFlowGraph } from "./layout";
import type { FlowEdgeData, FlowNodeData } from "./toFlow";
import type { OrgChartUser } from "./buildTree";

function stubUser(id: string): OrgChartUser {
  return {
    id,
    displayName: id,
    avatarUrl: null,
    position: "Role",
    managerId: null,
    orgChartHighlight: null,
    orgChartDashed: false,
    orgChartSortOrder: 0,
    departmentId: null,
    departmentName: null,
    orgChartPhotoUrl: null,
    additionalManagers: [],
  };
}

const DIMENSIONS = { width: 200, height: 96 };

// ceo -> [vp1, vp2] ; vp1 -> eng
const nodes: FlowNodeData[] = [
  { id: "ceo", user: stubUser("ceo"), parentId: null, depth: 0, descendantCount: 3 },
  { id: "vp1", user: stubUser("vp1"), parentId: "ceo", depth: 1, descendantCount: 1 },
  { id: "vp2", user: stubUser("vp2"), parentId: "ceo", depth: 1, descendantCount: 0 },
  { id: "eng", user: stubUser("eng"), parentId: "vp1", depth: 2, descendantCount: 0 },
];
const edges: FlowEdgeData[] = [
  { id: "ceo->vp1", source: "ceo", target: "vp1", dashed: false, secondary: false },
  { id: "ceo->vp2", source: "ceo", target: "vp2", dashed: false, secondary: false },
  { id: "vp1->eng", source: "vp1", target: "eng", dashed: false, secondary: false },
];

describe("layoutFlowGraph", () => {
  it("only positions nodes included in visibleIds", () => {
    const visibleIds = new Set(["ceo", "vp1", "vp2"]);
    const { positions } = layoutFlowGraph(nodes, edges, visibleIds, DIMENSIONS);

    expect(positions.size).toBe(3);
    expect(positions.has("eng")).toBe(false);
  });

  it("places a single visible root at its own position with no other rows", () => {
    const visibleIds = new Set(["ceo"]);
    const { positions } = layoutFlowGraph(nodes, edges, visibleIds, DIMENSIONS);

    expect(positions.size).toBe(1);
    expect(positions.has("ceo")).toBe(true);
  });

  it("places siblings at the same y (rank) and different x", () => {
    const visibleIds = new Set(["ceo", "vp1", "vp2"]);
    const { positions } = layoutFlowGraph(nodes, edges, visibleIds, DIMENSIONS);

    const vp1 = positions.get("vp1")!;
    const vp2 = positions.get("vp2")!;
    expect(vp1.y).toBe(vp2.y);
    expect(vp1.x).not.toBe(vp2.x);
  });

  it("centers a parent over the midpoint of its own children even when a sibling subtree is asymmetric", () => {
    // ceo -> [A, B, C, D, E, F] ; F -> [F1, F2, F3]
    // F's extra children skew dagre's default (non-local) alignment — both F
    // and ceo must still land centered over their own direct children's span.
    const wideNodes: FlowNodeData[] = [
      { id: "ceo", user: stubUser("ceo"), parentId: null, depth: 0, descendantCount: 9 },
      ...["A", "B", "C", "D", "E", "F"].map((id) => ({
        id,
        user: stubUser(id),
        parentId: "ceo",
        depth: 1,
        descendantCount: id === "F" ? 3 : 0,
      })),
      ...["F1", "F2", "F3"].map((id) => ({
        id,
        user: stubUser(id),
        parentId: "F",
        depth: 2,
        descendantCount: 0,
      })),
    ];
    const wideEdges: FlowEdgeData[] = [
      ...["A", "B", "C", "D", "E", "F"].map((id) => ({ id: `ceo->${id}`, source: "ceo", target: id, dashed: false, secondary: false })),
      ...["F1", "F2", "F3"].map((id) => ({ id: `F->${id}`, source: "F", target: id, dashed: false, secondary: false })),
    ];
    const visibleIds = new Set(wideNodes.map((n) => n.id));

    const { positions } = layoutFlowGraph(wideNodes, wideEdges, visibleIds, DIMENSIONS);

    const directReportXs = ["A", "B", "C", "D", "E", "F"].map((id) => positions.get(id)!.x);
    const expectedCeoX = (Math.min(...directReportXs) + Math.max(...directReportXs)) / 2;
    expect(positions.get("ceo")!.x).toBeCloseTo(expectedCeoX);

    const grandchildXs = ["F1", "F2", "F3"].map((id) => positions.get(id)!.x);
    const expectedFX = (Math.min(...grandchildXs) + Math.max(...grandchildXs)) / 2;
    expect(positions.get("F")!.x).toBeCloseTo(expectedFX);
  });

  it("lays out siblings left-to-right in the order they're given, not dagre's default ordering", () => {
    // F (with its own children, which skews dagre's natural ordering) is
    // listed FIRST here — the persisted admin order — even though dagre's
    // own crossing-minimization would not naturally place it first.
    const wideNodes: FlowNodeData[] = [
      { id: "ceo", user: stubUser("ceo"), parentId: null, depth: 0, descendantCount: 9 },
      { id: "F", user: stubUser("F"), parentId: "ceo", depth: 1, descendantCount: 3 },
      ...["A", "B", "C", "D", "E"].map((id) => ({
        id,
        user: stubUser(id),
        parentId: "ceo",
        depth: 1,
        descendantCount: 0,
      })),
      ...["F1", "F2", "F3"].map((id) => ({
        id,
        user: stubUser(id),
        parentId: "F",
        depth: 2,
        descendantCount: 0,
      })),
    ];
    const wideEdges: FlowEdgeData[] = [
      ...["F", "A", "B", "C", "D", "E"].map((id) => ({ id: `ceo->${id}`, source: "ceo", target: id, dashed: false, secondary: false })),
      ...["F1", "F2", "F3"].map((id) => ({ id: `F->${id}`, source: "F", target: id, dashed: false, secondary: false })),
    ];
    const visibleIds = new Set(wideNodes.map((n) => n.id));

    const { positions } = layoutFlowGraph(wideNodes, wideEdges, visibleIds, DIMENSIONS);

    const order = ["F", "A", "B", "C", "D", "E"].map((id) => positions.get(id)!.x);
    for (let i = 1; i < order.length; i++) {
      expect(order[i]).toBeGreaterThan(order[i - 1]);
    }
  });

  it("never overlaps grandchildren of different managers sharing the same rank", () => {
    // ceo -> [manager1 (9 kids), manager2 (no kids), manager3 (3 kids)]
    // A naive "relabel dagre's own x-values between siblings" reorder pass
    // drags manager1's wide 9-kid subtree into a slot only sized for a
    // single node once manager1/manager3 get reordered relative to each
    // other, colliding with manager3's subtree — this must not happen.
    const bigTeam = Array.from({ length: 9 }, (_, i) => `big${i}`);
    const smallTeam = ["small0", "small1", "small2"];
    const wideNodes: FlowNodeData[] = [
      { id: "ceo", user: stubUser("ceo"), parentId: null, depth: 0, descendantCount: 12 },
      { id: "manager1", user: stubUser("manager1"), parentId: "ceo", depth: 1, descendantCount: 9 },
      { id: "manager2", user: stubUser("manager2"), parentId: "ceo", depth: 1, descendantCount: 0 },
      { id: "manager3", user: stubUser("manager3"), parentId: "ceo", depth: 1, descendantCount: 3 },
      ...bigTeam.map((id) => ({ id, user: stubUser(id), parentId: "manager1", depth: 2, descendantCount: 0 })),
      ...smallTeam.map((id) => ({ id, user: stubUser(id), parentId: "manager3", depth: 2, descendantCount: 0 })),
    ];
    const wideEdges: FlowEdgeData[] = [
      ...["manager1", "manager2", "manager3"].map((id) => ({ id: `ceo->${id}`, source: "ceo", target: id, dashed: false, secondary: false })),
      ...bigTeam.map((id) => ({ id: `manager1->${id}`, source: "manager1", target: id, dashed: false, secondary: false })),
      ...smallTeam.map((id) => ({ id: `manager3->${id}`, source: "manager3", target: id, dashed: false, secondary: false })),
    ];
    const visibleIds = new Set(wideNodes.map((n) => n.id));

    const { positions } = layoutFlowGraph(wideNodes, wideEdges, visibleIds, DIMENSIONS);

    const depth2Xs = [...bigTeam, ...smallTeam].map((id) => positions.get(id)!.x).sort((a, b) => a - b);
    for (let i = 1; i < depth2Xs.length; i++) {
      expect(depth2Xs[i] - depth2Xs[i - 1]).toBeGreaterThanOrEqual(DIMENSIONS.width);
    }
  });

  it("respects root-level order for multiple top-level employees", () => {
    const rootNodes: FlowNodeData[] = [
      { id: "zed", user: stubUser("zed"), parentId: null, depth: 0, descendantCount: 0 },
      { id: "amy", user: stubUser("amy"), parentId: null, depth: 0, descendantCount: 0 },
    ];
    const visibleIds = new Set(rootNodes.map((n) => n.id));

    const { positions } = layoutFlowGraph(rootNodes, [], visibleIds, DIMENSIONS);

    expect(positions.get("zed")!.x).toBeLessThan(positions.get("amy")!.x);
  });
});
