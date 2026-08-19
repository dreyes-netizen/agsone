// Vocabulary for OrgChartAdditionalReport.relationshipType — secondary/support
// reporting lines on the org chart, distinct from the primary manager's own
// "Direct report / Dotted-line-support" toggle (User.orgChartDashed).
export const ORG_CHART_RELATIONSHIP_TYPES = ["dotted-line", "support", "functional", "matrix", "other"] as const;

export type OrgChartRelationshipType = (typeof ORG_CHART_RELATIONSHIP_TYPES)[number];

export const ORG_CHART_RELATIONSHIP_TYPE_LABEL: Record<OrgChartRelationshipType, string> = {
  "dotted-line": "Dotted-line",
  support: "Support",
  functional: "Functional",
  matrix: "Matrix",
  other: "Other",
};

export function isOrgChartRelationshipType(value: string): value is OrgChartRelationshipType {
  return (ORG_CHART_RELATIONSHIP_TYPES as readonly string[]).includes(value);
}
