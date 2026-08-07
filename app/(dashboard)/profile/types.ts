export type UserBadge = {
  id: string;
  awardedAt: string;
  badge: { name: string; description: string | null };
};

export type ShoutoutEntry = {
  id: string;
  post: {
    id: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
      department: { name: string } | null;
    };
  };
};

export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  pointsBalance: number;
  level: number;
  birthday: string | null;
  hireDate: string | null;
  bio: string | null;
  skills: string[];
  department: { id: string; name: string } | null;
  userBadges: UserBadge[];
};

export type PointTx = {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  category: string | null;
  activity: string | null;
  createdAt: string;
  fromUser: { displayName: string } | null;
};

export type RedemptionTx = {
  id: string;
  pointsSpent: number;
  createdAt: string;
  reward: { name: string };
};

export type PointsData = {
  balance: number;
  level: number;
  totalEarned: number;
  transactions: PointTx[];
  redemptions: RedemptionTx[];
};

export type TimelineEntry =
  | { kind: "earn"; data: PointTx }
  | { kind: "redeem"; data: RedemptionTx };
