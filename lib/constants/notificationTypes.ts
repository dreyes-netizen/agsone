/**
 * The single source of truth for every notification type in AGS One.
 *
 * Notification `type` is a free-form String in the schema, and before this file
 * the type strings were written by hand at ~19 separate call sites. That drift
 * is what produced the three inert preference toggles (`POINTS_AWARDED` matched
 * no emitter, `MISSION_COMPLETED` had none at all) and the broken deep links
 * (the bell routed two types nothing emits, while several real ones fell
 * through to `null` and rendered unclickable).
 *
 * Everything downstream now reads from here:
 *   - lib/helpers/createNotification.ts  — defaults, grouping, pref lookup
 *   - app/api/me/notification-preferences — the toggleable set and its defaults
 *   - profile/components/NotificationsTab — the rows, grouped by `group`
 *   - components/notifications/NotificationBell — deep links via `href()`
 *
 * Adding a notification means adding an entry here first. If a type is emitted
 * without one, `createNotification` still delivers it (fail-open — never lose a
 * notification over a missing config) but logs loudly.
 */

export const NOTIFICATION_GROUPS = [
  "Points & Recognition",
  "Requests & Approvals",
  "Food",
  "Social",
  "Minigames",
  "Admin",
] as const;

export type NotificationGroup = (typeof NOTIFICATION_GROUPS)[number];

/** Who a type is aimed at — drives which rows the prefs UI shows a given user. */
export type NotificationAudience = "everyone" | "admin" | "manager";

/** `Notification.data` is Json; every href/groupKey reader must tolerate absence. */
export type NotificationData = Record<string, unknown> | null | undefined;

export type NotificationEntry = {
  /** Row label in the preferences UI. */
  label: string;
  /** Row subtitle — plain language, describes when it fires. */
  description: string;
  group: NotificationGroup;
  audience: NotificationAudience;
  /** Where clicking the notification goes. `null` = not clickable. */
  href: (data: NotificationData) => string | null;
  /**
   * false = the user cannot switch it off. Reserved for outcomes of the user's
   * own request, balance changes, and compliance messages — things where "I
   * never saw it" is a worse outcome than "I didn't want it".
   */
  toggleable: boolean;
  defaults: { inApp: boolean; push: boolean };
  /**
   * Returns a key that collapses repeat events onto one row, or null to always
   * insert. See createNotification — only unread rows are merged into.
   */
  groupKey?: (data: NotificationData) => string | null;
};

const str = (data: NotificationData, key: string): string | null => {
  const v = data?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
};

/**
 * The feed has no single-post route and ignores query params today, so this
 * lands on /feed regardless. The id is included so the payload is already
 * correct when the feed learns to scroll to a post — see AGSON follow-up.
 */
const feedPost = (data: NotificationData): string => {
  const id = str(data, "postId");
  return id ? `/feed?post=${id}` : "/feed";
};

export const NOTIFICATION_TYPES = {
  // ─── Points & Recognition ────────────────────────────────────────────────
  POINTS_RECEIVED: {
    label: "Points awarded to you",
    description: "When someone awards you points",
    group: "Points & Recognition",
    audience: "everyone",
    href: () => "/profile",
    toggleable: true,
    defaults: { inApp: true, push: true },
  },
  POINTS_DEDUCTED: {
    label: "Points deducted",
    description: "When points are removed from your balance",
    group: "Points & Recognition",
    audience: "everyone",
    href: () => "/profile",
    toggleable: false, // balance change — never silent
    defaults: { inApp: true, push: true },
  },
  SHOUTOUT_RECEIVED: {
    label: "Shoutout received",
    description: "When a colleague shouts you out",
    group: "Points & Recognition",
    audience: "everyone",
    href: feedPost,
    toggleable: true,
    defaults: { inApp: true, push: true },
  },
  BADGE_EARNED: {
    label: "Badge unlocked",
    description: "When you earn a new badge",
    group: "Points & Recognition",
    audience: "everyone",
    href: () => "/profile",
    toggleable: true,
    defaults: { inApp: true, push: true },
    // Crossing several thresholds at once used to arrive as N separate rows.
    groupKey: (d) => (str(d, "userId") ? `badge:${str(d, "userId")}` : "badge"),
  },
  LEVEL_UP: {
    label: "Level up",
    description: "When you reach a new level",
    group: "Points & Recognition",
    audience: "everyone",
    href: () => "/profile",
    toggleable: true,
    defaults: { inApp: true, push: true },
  },

  // ─── Requests & Approvals ────────────────────────────────────────────────
  REDEMPTION_APPROVED: {
    label: "Redemption approved",
    description: "When your reward request is approved",
    group: "Requests & Approvals",
    audience: "everyone",
    href: () => "/marketplace?tab=requests",
    toggleable: false,
    defaults: { inApp: true, push: true },
  },
  REDEMPTION_REJECTED: {
    label: "Redemption rejected",
    description: "When your reward request is declined and points are refunded",
    group: "Requests & Approvals",
    audience: "everyone",
    href: () => "/marketplace?tab=requests",
    toggleable: false,
    defaults: { inApp: true, push: true },
  },
  REDEMPTION_FULFILLED: {
    label: "Redemption fulfilled",
    description: "When your reward is ready or has been handed over",
    group: "Requests & Approvals",
    audience: "everyone",
    href: () => "/marketplace?tab=requests",
    toggleable: false,
    defaults: { inApp: true, push: true },
  },
  MEDICINE_APPROVED: {
    label: "Medicine request approved",
    description: "When your medicine request is approved for pickup",
    group: "Requests & Approvals",
    audience: "everyone",
    href: () => "/medicine",
    toggleable: false,
    defaults: { inApp: true, push: true },
  },
  MEDICINE_REJECTED: {
    label: "Medicine request declined",
    description: "When your medicine request is declined",
    group: "Requests & Approvals",
    audience: "everyone",
    href: () => "/medicine",
    toggleable: false,
    defaults: { inApp: true, push: true },
  },

  // ─── Food ────────────────────────────────────────────────────────────────
  FOOD_ORDER_PLACED: {
    label: "New order on your listing",
    description: "When someone orders from food you listed",
    group: "Food",
    audience: "everyone",
    href: () => "/food",
    toggleable: true,
    defaults: { inApp: true, push: true },
    groupKey: (d) => (str(d, "listingId") ? `food-order:${str(d, "listingId")}` : null),
  },
  FOOD_ORDER_CANCELLED: {
    label: "Order cancelled",
    description: "When a buyer cancels an order on your listing",
    group: "Food",
    audience: "everyone",
    href: () => "/food",
    toggleable: true,
    defaults: { inApp: true, push: false },
  },
  FOOD_ORDER_PAID: {
    label: "Payment confirmed",
    description: "When a seller marks your order as paid",
    group: "Food",
    audience: "everyone",
    href: () => "/food",
    toggleable: true,
    defaults: { inApp: true, push: true },
  },
  FOOD_LISTING_CANCELLED: {
    label: "A listing you ordered from was cancelled",
    description: "When a seller closes or deletes a listing you have an order on",
    group: "Food",
    audience: "everyone",
    href: () => "/food",
    toggleable: false, // their order was destroyed — they must be told
    defaults: { inApp: true, push: true },
  },

  // ─── Social ──────────────────────────────────────────────────────────────
  MENTION: {
    label: "Mentions",
    description: "When someone @mentions you in a post",
    group: "Social",
    audience: "everyone",
    href: feedPost,
    toggleable: true,
    defaults: { inApp: true, push: true },
  },
  COMMENT_ON_POST: {
    label: "Comments on your post",
    description: "When someone comments on something you posted",
    group: "Social",
    audience: "everyone",
    href: feedPost,
    toggleable: true,
    defaults: { inApp: true, push: false },
    groupKey: (d) => (str(d, "postId") ? `comment:${str(d, "postId")}` : null),
  },
  REPLY_TO_COMMENT: {
    label: "Replies to your comment",
    description: "When someone replies to a comment you wrote",
    group: "Social",
    audience: "everyone",
    href: feedPost,
    toggleable: true,
    defaults: { inApp: true, push: false },
    groupKey: (d) => (str(d, "commentId") ? `reply:${str(d, "commentId")}` : null),
  },
  REACTION: {
    label: "Reactions to your post",
    description: "When someone reacts to something you posted",
    group: "Social",
    audience: "everyone",
    href: feedPost,
    toggleable: true,
    // Highest-volume event in the app. Grouped, and push off by default.
    defaults: { inApp: true, push: false },
    groupKey: (d) => (str(d, "postId") ? `reaction:${str(d, "postId")}` : null),
  },
  POLL_VOTE: {
    label: "Votes on your poll",
    description: "When someone votes in a poll you created",
    group: "Social",
    audience: "everyone",
    href: feedPost,
    toggleable: true,
    defaults: { inApp: false, push: false }, // opt-in
    groupKey: (d) => (str(d, "postId") ? `vote:${str(d, "postId")}` : null),
  },

  // ─── Minigames ───────────────────────────────────────────────────────────
  GAME_INVITE: {
    label: "Game invites",
    description: "When someone challenges you to a minigame",
    group: "Minigames",
    audience: "everyone",
    href: (d) => (str(d, "sessionId") ? `/minigames/${str(d, "sessionId")}` : "/minigames"),
    toggleable: true,
    defaults: { inApp: true, push: true },
  },
  GAME_JOINED: {
    label: "Someone joined your challenge",
    description: "When an opponent takes your open challenge and the game starts",
    group: "Minigames",
    audience: "everyone",
    href: (d) => (str(d, "sessionId") ? `/minigames/${str(d, "sessionId")}` : "/minigames"),
    toggleable: true,
    defaults: { inApp: true, push: true },
  },
  GAME_YOUR_TURN: {
    label: "Your turn",
    description: "When an opponent moves and the game is waiting on you",
    group: "Minigames",
    audience: "everyone",
    href: (d) => (str(d, "sessionId") ? `/minigames/${str(d, "sessionId")}` : "/minigames"),
    toggleable: true,
    defaults: { inApp: true, push: true },
    // Throttled at the call site too; grouping stops a fast exchange stacking.
    groupKey: (d) => (str(d, "sessionId") ? `turn:${str(d, "sessionId")}` : null),
  },
  GAME_WIN: {
    label: "Game results",
    description: "When a minigame you played finishes",
    group: "Minigames",
    audience: "everyone",
    href: (d) => (str(d, "sessionId") ? `/minigames/${str(d, "sessionId")}` : "/minigames"),
    toggleable: true,
    defaults: { inApp: true, push: true },
  },
  GAME_LOST: {
    label: "Game results (losses)",
    description: "When you lose a minigame",
    group: "Minigames",
    audience: "everyone",
    href: (d) => (str(d, "sessionId") ? `/minigames/${str(d, "sessionId")}` : "/minigames"),
    toggleable: true,
    defaults: { inApp: true, push: false },
  },
  GAME_DRAW: {
    label: "Game results (draws)",
    description: "When a minigame ends in a tie",
    group: "Minigames",
    audience: "everyone",
    href: (d) => (str(d, "sessionId") ? `/minigames/${str(d, "sessionId")}` : "/minigames"),
    toggleable: true,
    defaults: { inApp: true, push: false },
  },

  // ─── Feedback (compliance — not toggleable) ──────────────────────────────
  FEEDBACK_HR_REPLIED: {
    label: "HR replied to your report",
    description: "When HR responds on a report you filed",
    group: "Requests & Approvals",
    audience: "everyone",
    href: () => "/feedback",
    toggleable: false,
    defaults: { inApp: true, push: true },
  },
  FEEDBACK_RESOLVED: {
    label: "Report resolved",
    description: "When a report you filed is marked resolved",
    group: "Requests & Approvals",
    audience: "everyone",
    href: () => "/feedback",
    toggleable: false,
    defaults: { inApp: true, push: true },
  },
  FEEDBACK_EMPLOYEE_REPLIED: {
    label: "Reporter replied",
    description: "When an employee responds on a report you are handling",
    group: "Admin",
    audience: "admin",
    href: (d) => (str(d, "feedbackId") ? `/admin/feedback/${str(d, "feedbackId")}` : "/admin/feedback"),
    toggleable: false,
    defaults: { inApp: true, push: true },
  },

  // ─── Admin queues ────────────────────────────────────────────────────────
  MEDICINE_REQUESTED: {
    label: "New medicine request",
    description: "When an employee requests medicine and it needs approval",
    group: "Admin",
    audience: "admin",
    href: () => "/admin/medicine",
    toggleable: true,
    defaults: { inApp: true, push: false },
    groupKey: () => "queue:medicine",
  },
  REDEMPTION_REQUESTED: {
    label: "New reward redemption",
    description: "When an employee redeems a reward and it needs approval",
    group: "Admin",
    audience: "admin",
    href: () => "/admin/redemptions",
    toggleable: true,
    defaults: { inApp: true, push: false },
    groupKey: () => "queue:redemption",
  },
  FEEDBACK_SUBMITTED: {
    label: "New whistleblower report",
    description: "When a new confidential report is filed",
    group: "Admin",
    audience: "admin",
    href: () => "/admin/feedback",
    toggleable: false, // compliance — must reach whoever holds the role
    defaults: { inApp: true, push: true },
    // Deliberately NOT grouped: each report is its own matter to action.
  },

  // ─── Manager ─────────────────────────────────────────────────────────────
  BUDGET_LOW: {
    label: "Award budget running low",
    description: "When you have used 80% of your monthly recognition budget",
    group: "Admin",
    audience: "manager",
    href: () => "/profile",
    toggleable: true,
    defaults: { inApp: true, push: false },
    groupKey: (d) => `budget-low:${str(d, "period") ?? "current"}`,
  },
  BUDGET_EXHAUSTED: {
    label: "Award budget exhausted",
    description: "When an award is blocked because your monthly budget is spent",
    group: "Admin",
    audience: "manager",
    href: () => "/profile",
    toggleable: true,
    defaults: { inApp: true, push: false },
    groupKey: (d) => `budget-out:${str(d, "period") ?? "current"}`,
  },
} as const satisfies Record<string, NotificationEntry>;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

export function getNotificationEntry(type: string): NotificationEntry | null {
  return (NOTIFICATION_TYPES as Record<string, NotificationEntry>)[type] ?? null;
}

/** Types a user may switch on or off, in stable display order. */
export const TOGGLEABLE_TYPES = (
  Object.keys(NOTIFICATION_TYPES) as NotificationType[]
).filter((t) => NOTIFICATION_TYPES[t].toggleable);

/**
 * Renamed pref keys. The stored JSON on existing users still carries the old
 * key, so a read-time alias keeps someone who opted out of "Points" opted out
 * rather than silently re-subscribing them.
 */
export const PREF_KEY_ALIASES: Record<string, NotificationType> = {
  POINTS_AWARDED: "POINTS_RECEIVED",
};

/** Default in-app enablement for a type, honouring aliases. */
export function isEnabledByDefault(type: string): boolean {
  return getNotificationEntry(type)?.defaults.inApp ?? true;
}
