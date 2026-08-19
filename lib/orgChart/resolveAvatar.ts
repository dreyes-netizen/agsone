import { buildOrgChartPhotoUrl } from "@/lib/cloudinary/orgChartPhoto";

// Display precedence for the org chart's avatar: a chart-specific photo
// override, then the account's regular profile photo, then null (EmployeeNode
// falls back to an initials avatar from there). Never the reverse — this is
// read-only with respect to avatarUrl, so uploading an override can't change
// what shows anywhere outside the chart.
export function resolveOrgChartAvatarUrl({
  orgChartPhotoPublicId,
  avatarUrl,
}: {
  orgChartPhotoPublicId: string | null;
  avatarUrl: string | null;
}): string | null {
  if (orgChartPhotoPublicId) return buildOrgChartPhotoUrl(orgChartPhotoPublicId);
  return avatarUrl;
}

// Shared shape for any Prisma `user` select that needs the override resolved
// — the org chart itself, and anywhere else in the app that shows the same
// "professional headshot" (currently Points of Contact). Keeping this one
// definition shared means every such surface reflects an uploaded override
// identically, rather than each call site re-deriving its own select/mapping
// and risking drift.
export const USER_PHOTO_SELECT = {
  avatarUrl: true,
  orgChartPhotoPublicId: true,
} as const;

// Strips the internal orgChartPhotoPublicId out of a Prisma result and
// replaces it with the resolved, client-safe orgChartPhotoUrl. Never expose
// orgChartPhotoPublicId itself to the client — it's a Cloudinary asset
// reference, not a display value.
export function withOrgChartPhotoUrl<T extends { avatarUrl: string | null; orgChartPhotoPublicId: string | null }>(
  user: T,
): Omit<T, "orgChartPhotoPublicId"> & { orgChartPhotoUrl: string | null } {
  const { orgChartPhotoPublicId, ...rest } = user;
  return { ...rest, orgChartPhotoUrl: resolveOrgChartAvatarUrl({ orgChartPhotoPublicId, avatarUrl: user.avatarUrl }) };
}
