const ADMIN_ROLES = new Set(["HR_ADMIN", "SUPER_ADMIN"]);

/**
 * Pin/edit/delete gating for a feed post — pulled out of feed/page.tsx so the
 * media viewer's sidebar (a third render site for the same post) doesn't have
 * to re-derive these booleans a third time.
 */
export function getPostPermissions(
  post: { authorId: string },
  actor: { id: string; role: string } | null | undefined,
) {
  const isAdmin = !!actor && ADMIN_ROLES.has(actor.role);
  const isAuthor = !!actor && post.authorId === actor.id;
  return {
    canPin: isAdmin,
    canEdit: isAuthor || isAdmin,
    canDelete: isAuthor || isAdmin,
  };
}
