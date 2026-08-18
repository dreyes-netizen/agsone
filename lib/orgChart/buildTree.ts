export type OrgChartUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  position: string | null;
  managerId: string | null;
  orgChartHighlight: string | null;
  orgChartDashed: boolean;
};

export type OrgChartTreeEntry = {
  node: OrgChartUser;
  children: OrgChartTreeEntry[];
};

// Builds one tree per root from a flat list of chart members (anyone with
// `position` set). A member whose manager isn't also a chart member is
// treated as a root too, so they're never silently dropped from the chart.
export function buildOrgChartTree(nodes: OrgChartUser[]): OrgChartTreeEntry[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenByParent = new Map<string, OrgChartUser[]>();

  for (const n of nodes) {
    if (n.managerId && byId.has(n.managerId)) {
      const siblings = childrenByParent.get(n.managerId) ?? [];
      siblings.push(n);
      childrenByParent.set(n.managerId, siblings);
    }
  }

  const byName = (a: OrgChartUser, b: OrgChartUser) => a.displayName.localeCompare(b.displayName);

  function build(n: OrgChartUser): OrgChartTreeEntry {
    const children = (childrenByParent.get(n.id) ?? []).sort(byName).map(build);
    return { node: n, children };
  }

  const roots = nodes.filter((n) => !n.managerId || !byId.has(n.managerId));
  return roots.sort(byName).map(build);
}
