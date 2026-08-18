import { describe, it, expect } from "vitest";
import { buildFlowGraph } from "./toFlow";
import type { OrgChartTreeEntry, OrgChartUser } from "./buildTree";

function user(overrides: Partial<OrgChartUser> & { id: string }): OrgChartUser {
  return {
    displayName: overrides.id,
    avatarUrl: null,
    position: "Role",
    managerId: null,
    orgChartHighlight: null,
    orgChartDashed: false,
    orgChartSortOrder: 0,
    departmentId: null,
    departmentName: null,
    ...overrides,
  };
}

// ceo -> vp -> [eng (dashed), designer]
function fixture(): OrgChartTreeEntry[] {
  const eng = user({ id: "eng", managerId: "vp", orgChartDashed: true });
  const designer = user({ id: "designer", managerId: "vp" });
  const vp = user({ id: "vp", managerId: "ceo" });
  const ceo = user({ id: "ceo" });

  return [
    {
      node: ceo,
      children: [
        {
          node: vp,
          children: [
            { node: eng, children: [] },
            { node: designer, children: [] },
          ],
        },
      ],
    },
  ];
}

describe("buildFlowGraph", () => {
  it("flattens the forest into nodes with correct depth and descendant counts", () => {
    const { nodes, depthById, descendantCountById } = buildFlowGraph(fixture());

    expect(nodes).toHaveLength(4);
    expect(depthById.get("ceo")).toBe(0);
    expect(depthById.get("vp")).toBe(1);
    expect(depthById.get("eng")).toBe(2);
    expect(descendantCountById.get("ceo")).toBe(3);
    expect(descendantCountById.get("vp")).toBe(2);
    expect(descendantCountById.get("eng")).toBe(0);
  });

  it("derives edge `dashed` from the child's orgChartDashed flag, not the parent's", () => {
    const { edges } = buildFlowGraph(fixture());

    const engEdge = edges.find((e) => e.target === "eng");
    const designerEdge = edges.find((e) => e.target === "designer");

    expect(engEdge?.dashed).toBe(true);
    expect(designerEdge?.dashed).toBe(false);
  });

  it("sets parentId null and depth 0 for roots, and produces no edge for them", () => {
    const { nodes, edges } = buildFlowGraph(fixture());

    const ceoNode = nodes.find((n) => n.id === "ceo");
    expect(ceoNode?.parentId).toBeNull();
    expect(edges.some((e) => e.target === "ceo")).toBe(false);
  });
});
