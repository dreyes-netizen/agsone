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
  shoutoutRecipients: { id: string; userId: string; user: { id: string; displayName: string; avatarUrl: string | null } }[];
  reactions: Record<string, number>;
  myReactions: string[];
  commentCount: number;
  pollOptions: PollOption[];
  myVoteOptionId: string | null;
  departmentId: string | null;
  department: { name: string } | null;
};

export type ReplyItem = {
  id: string;
  content: string;
  createdAt: string;
  parentId: string | null;
  authorId: string;
  author: { displayName: string; avatarUrl: string | null };
};

export type CommentItem = {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
  author: { displayName: string; avatarUrl: string | null };
  replies: ReplyItem[];
};

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
