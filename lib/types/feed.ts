export type PollOption = {
  id: string;
  text: string;
  _count: { votes: number };
};

export type FeedPost = {
  id: string;
  authorId: string;
  type: string;
  title: string | null;
  content: string;
  imageUrls: string[];
  createdAt: string;
  isPinned: boolean;
  flair: string;
  author: { displayName: string; avatarUrl: string | null; department: { name: string } | null };
  shoutoutRecipients: { id: string; userId: string; user: { id: string; displayName: string; avatarUrl: string | null; department: { name: string } | null } }[];
  reactions: Record<string, number>;
  myReactions: string[];
  commentCount: number;
  pollOptions: PollOption[];
  myVoteOptionId: string | null;
  isAnonymous: boolean;
  departmentId: string | null;
  department: { name: string } | null;
};

export type ReactorItem = {
  id: string;
  emoji: string;
  createdAt: string;
  isCurrentUser: boolean;
  user: { id: string; displayName: string; avatarUrl: string | null; department: string | null };
};

export type VoterItem = {
  id: string;
  optionId: string;
  optionText: string;
  createdAt: string;
  isCurrentUser: boolean;
  user: { id: string; displayName: string; avatarUrl: string | null; department: string | null };
};

export type CommentType = "TEXT" | "GIF";

export type ReplyItem = {
  id: string;
  content: string | null;
  commentType: CommentType;
  gifProvider: string | null;
  gifId: string | null;
  createdAt: string;
  parentId: string | null;
  authorId: string;
  author: { displayName: string; avatarUrl: string | null };
  reactions: Record<string, number>;
  myReactions: string[];
};

export type CommentItem = {
  id: string;
  content: string | null;
  commentType: CommentType;
  gifProvider: string | null;
  gifId: string | null;
  createdAt: string;
  authorId: string;
  author: { displayName: string; avatarUrl: string | null };
  reactions: Record<string, number>;
  myReactions: string[];
  replies: ReplyItem[];
};

/**
 * The open reply composer's target.
 *
 * `commentId` is ALWAYS the top-level comment id, never a reply's own id:
 * threading is capped at two levels Facebook-style, so replying to a reply
 * files the new comment under the same top-level parent and identifies who
 * is being answered with an @mention instead of nesting deeper. That keeps
 * every fixed-depth walk over the comment tree (findCommentById, the
 * optimistic cache patches, gifIdsOf) correct without becoming recursive.
 *
 * Declared here rather than in a component because CommentThread,
 * PostViewerSidebar, MediaViewer and useFeedActions all pass it through.
 */
export type ReplyTarget = {
  postId: string;
  commentId: string;
  /** Who is being replied to — drives the composer placeholder. */
  displayName: string;
  /** Set only when replying to a reply: seeds an @mention of that reply's author. */
  mentionUserId?: string;
} | null;

export type UserProfile = {
  pointsBalance: number;
  level: number;
  displayName: string;
  department: { id: string; name: string } | null;
};

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  isCurrentUser: boolean;
};

export type BirthdayPerson = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  daysUntil: number;
};
