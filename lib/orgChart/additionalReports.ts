import { isOrgChartRelationshipType } from "@/lib/constants/orgChartRelationshipTypes";

export type ValidateAdditionalReportInput = {
  userId: string;
  managerId: string;
  relationshipType: string;
  primaryManagerId: string | null;
  existingManagerIds: string[];
};

// Pure validator for adding a secondary/support reporting relationship —
// injected data only (no Prisma), so it's testable without a database, same
// pattern as wouldCreateCycle in lib/orgChart/cycles.ts. The caller
// (app/api/admin/org-chart/additional-reports/route.ts) is responsible for
// confirming both users actually exist and that managerId is a current chart
// member; this only checks the relationship's own shape.
export function validateAdditionalReport({
  userId,
  managerId,
  relationshipType,
  primaryManagerId,
  existingManagerIds,
}: ValidateAdditionalReportInput): string | null {
  if (userId === managerId) return "An employee cannot have a reporting relationship to themselves";
  if (!isOrgChartRelationshipType(relationshipType)) return "Invalid relationship type";
  if (primaryManagerId && managerId === primaryManagerId) {
    return "This person is already the primary manager — pick a different manager for the additional relationship";
  }
  if (existingManagerIds.includes(managerId)) {
    return "That additional reporting relationship already exists";
  }
  return null;
}
