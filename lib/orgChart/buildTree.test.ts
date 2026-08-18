import { describe, it, expect, vi } from "vitest";
import { buildOrgChartTree, type OrgChartUser } from "./buildTree";

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

describe("buildOrgChartTree", () => {
  it("builds a single-root tree from a simple manager chain", () => {
    const ceo = user({ id: "ceo", displayName: "Alice" });
    const vp = user({ id: "vp", displayName: "Bob", managerId: "ceo" });
    const eng = user({ id: "eng", displayName: "Cara", managerId: "vp" });

    const tree = buildOrgChartTree([eng, vp, ceo]);

    expect(tree).toHaveLength(1);
    expect(tree[0].node.id).toBe("ceo");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].node.id).toBe("vp");
    expect(tree[0].children[0].children[0].node.id).toBe("eng");
  });

  it("treats every manager-less member as a root, sorted by name when sort order ties", () => {
    const b = user({ id: "b", displayName: "Bravo" });
    const a = user({ id: "a", displayName: "Alpha" });

    const tree = buildOrgChartTree([b, a]);

    expect(tree.map((e) => e.node.id)).toEqual(["a", "b"]);
  });

  it("sorts siblings by orgChartSortOrder, overriding alphabetical order", () => {
    const zed = user({ id: "zed", displayName: "Zed", managerId: "boss", orgChartSortOrder: 0 });
    const amy = user({ id: "amy", displayName: "Amy", managerId: "boss", orgChartSortOrder: 1 });
    const boss = user({ id: "boss", displayName: "Boss" });

    const tree = buildOrgChartTree([boss, zed, amy]);

    expect(tree[0].children.map((c) => c.node.id)).toEqual(["zed", "amy"]);
  });

  it("treats a member whose manager isn't also a chart member as a root", () => {
    const orphan = user({ id: "orphan", displayName: "Orphan", managerId: "not-in-chart" });

    const tree = buildOrgChartTree([orphan]);

    expect(tree).toHaveLength(1);
    expect(tree[0].node.id).toBe("orphan");
    expect(tree[0].children).toHaveLength(0);
  });

  it("treats a self-referencing manager id as a root instead of dropping or duplicating the employee", () => {
    const self = user({ id: "self", displayName: "Self", managerId: "self" });
    const other = user({ id: "other", displayName: "Other", managerId: "self" });

    const tree = buildOrgChartTree([self, other]);

    expect(tree).toHaveLength(1);
    expect(tree[0].node.id).toBe("self");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].node.id).toBe("other");
  });

  it("does not hang or throw on a circular manager relationship", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const a = user({ id: "a", displayName: "A", managerId: "b" });
    const b = user({ id: "b", displayName: "B", managerId: "a" });
    const root = user({ id: "root", displayName: "Root" });

    const tree = buildOrgChartTree([a, b, root]);

    // Neither cycle member has a manager outside the cycle, so neither
    // qualifies as a root; the unrelated root still builds fine.
    expect(tree.map((e) => e.node.id)).toEqual(["root"]);
    expect(tree[0].children).toHaveLength(0);
    errorSpy.mockRestore();
  });
});
