import type { RewardCategory } from "@/lib/constants/rewardCategories";

export type Reward = {
  id: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  pointCost: number;
  stockQuantity: number;
  category: RewardCategory;
  createdAt: string;
  _count?: { redemptions: number };
};

export type RedemptionStatus = "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED";

export type Redemption = {
  id: string;
  status: RedemptionStatus;
  pointsSpent: number;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  reward: { name: string; pointCost: number; category: RewardCategory };
};

export type SortOption = "recommended" | "lowest" | "highest" | "newest" | "mostRedeemed";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "lowest", label: "Lowest points" },
  { value: "highest", label: "Highest points" },
  { value: "newest", label: "Newest" },
  { value: "mostRedeemed", label: "Most redeemed" },
];

export type MarketplaceView = "browse" | "requests";
