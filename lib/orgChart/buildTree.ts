export type OrgChartAdditionalManager = {
  managerId: string;
  relationshipType: string;
};

export type OrgChartUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  position: string | null;
  managerId: string | null;
  orgChartHighlight: string | null;
  orgChartDashed: boolean;
  orgChartSortOrder: number;
  departmentId: string | null;
  departmentName: string | null;
  orgChartPhotoUrl: string | null;
  additionalManagers: OrgChartAdditionalManager[];
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
    if (n.managerId && n.managerId !== n.id && byId.has(n.managerId)) {
      const siblings = childrenByParent.get(n.managerId) ?? [];
      siblings.push(n);
      childrenByParent.set(n.managerId, siblings);
    }
  }

  // Admin-controlled display order (see components/org-chart admin edit mode)
  // takes priority; displayName is only a tiebreaker for equal/default (0)
  // sort orders, keeping unordered groups deterministic.
  const bySortOrder = (a: OrgChartUser, b: OrgChartUser) =>
    a.orgChartSortOrder - b.orgChartSortOrder || a.displayName.localeCompare(b.displayName);

  // A malformed managerId chain (e.g. A reports to B, B reports to A) would
  // otherwise recurse forever. `built` guards each node from being expanded
  // more than once across the whole forest; a node hit a second time (via a
  // cycle, or bad data pointing two managers at the same report) is stubbed
  // as a leaf instead of recursing again.
  const built = new Set<string>();

  function build(n: OrgChartUser): OrgChartTreeEntry {
    if (built.has(n.id)) {
      console.error(`buildOrgChartTree: cycle or duplicate parentage detected at user ${n.id}`);
      return { node: n, children: [] };
    }
    built.add(n.id);
    const children = (childrenByParent.get(n.id) ?? []).sort(bySortOrder).map(build);
    return { node: n, children };
  }

  // A self-referencing record (managerId === own id) would otherwise pass
  // the `byId.has(n.managerId)` check and be treated as its own child,
  // vanishing from every root's build() walk instead of rendering anywhere.
  const roots = nodes.filter((n) => !n.managerId || n.managerId === n.id || !byId.has(n.managerId));
  return roots.sort(bySortOrder).map(build);
}
