import { describe, it, expect } from "vitest";
import { buildOrgChartTree, type OrgChartUser } from "./buildTree";
import { buildFlowGraph } from "./toFlow";

function makeUser(overrides: Partial<OrgChartUser> & { id: string }): OrgChartUser {
  return {
    displayName: overrides.id,
    avatarUrl: null,
    position: "Some Position",
    managerId: null,
    orgChartHighlight: null,
    orgChartDashed: false,
    orgChartSortOrder: 0,
    departmentId: null,
    departmentName: null,
    orgChartPhotoUrl: null,
    additionalManagers: [],
    ...overrides,
  };
}

describe("buildFlowGraph — secondary (additional reporting) edges", () => {
  it("is unchanged when additionalManagers is empty (primary-only chart)", () => {
    const darrell = makeUser({ id: "darrell" });
    const carl = makeUser({ id: "carl", managerId: "darrell" });
    const graph = buildFlowGraph(buildOrgChartTree([darrell, carl]));

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ source: "darrell", target: "carl", secondary: false });
  });

  it("adds a non-structural secondary edge for each additional relationship", () => {
    const darrell = makeUser({ id: "darrell" });
    const iza = makeUser({ id: "iza" });
    const carl = makeUser({
      id: "carl",
      managerId: "darrell",
      additionalManagers: [{ managerId: "iza", relationshipType: "dotted-line" }],
    });
    const graph = buildFlowGraph(buildOrgChartTree([darrell, iza, carl]));

    const secondaryEdges = graph.edges.filter((e) => e.secondary);
    expect(secondaryEdges).toHaveLength(1);
    expect(secondaryEdges[0]).toMatchObject({ source: "iza", target: "carl", dashed: true, relationshipType: "dotted-line" });

    // The primary edge (darrell -> carl) is untouched by the secondary one.
    const primaryEdges = graph.edges.filter((e) => !e.secondary);
    expect(primaryEdges).toHaveLength(1);
    expect(primaryEdges[0]).toMatchObject({ source: "darrell", target: "carl" });
  });

  it("excludes secondary relationships from descendant counts and depth", () => {
    const darrell = makeUser({ id: "darrell" });
    const iza = makeUser({ id: "iza" }); // no primary reports of her own
    const carl = makeUser({
      id: "carl",
      managerId: "darrell",
      additionalManagers: [{ managerId: "iza", relationshipType: "support" }],
    });
    const graph = buildFlowGraph(buildOrgChartTree([darrell, iza, carl]));

    expect(graph.descendantCountById.get("iza")).toBe(0); // carl is NOT counted as iza's descendant
    expect(graph.descendantCountById.get("darrell")).toBe(1); // carl still counts under his primary manager
    expect(graph.depthById.get("carl")).toBe(1); // driven by primary parent only
  });

  it("drops a dangling additional relationship pointing at someone no longer in the chart", () => {
    const carl = makeUser({
      id: "carl",
      additionalManagers: [{ managerId: "someone-who-left", relationshipType: "matrix" }],
    });
    const graph = buildFlowGraph(buildOrgChartTree([carl]));

    expect(graph.edges).toHaveLength(0);
  });
});
