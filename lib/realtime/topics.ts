/**
 * Realtime topics carry invalidation pings only. They never carry database
 * rows, authorization decisions, or user-entered content.
 *
 * Keeping topic names here prevents a route and its client screen from
 * silently drifting apart. The authenticated API remains the source of every
 * payload after a ping is received.
 */
export const realtimeTopics = {
  feed: "feed",
  leaderboard: "leaderboard",
  pointsTransactions: "points:transactions",
  employees: "employees",
  departments: "departments",
  rewards: "rewards",
  redemptionsAdmin: "redemptions:admin",
  food: "food",
  medicine: "medicine",
  medicineRequests: "medicine:requests",
  settings: "settings",
  documents: "documents",
  milestones: "milestones",
  adminAnalytics: "admin:analytics",
  adminAudit: "admin:audit",
  minigameStats: "minigames:stats",

  profile: (userId: string) => `profile:${userId}`,
  redemptionsUser: (userId: string) => `redemptions:user:${userId}`,
  medicineUser: (userId: string) => `medicine:user:${userId}`,
  notificationPreferences: (userId: string) => `notification-preferences:${userId}`,
} as const;
