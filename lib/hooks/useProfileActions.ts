"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";

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
  bannerUrl: string | null;
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

export type ProfileTab = "overview" | "points" | "badges" | "notifications";

export function useProfileActions() {
  const { user: authUser, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean> | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState<string | null>(null);
  const [notifError, setNotifError] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const [isEditing, setIsEditing] = useState(false);
  const [bioEdit, setBioEdit] = useState("");
  const [skillsEdit, setSkillsEdit] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [deptRank, setDeptRank] = useState<{ rank: number; total: number } | null>(null);
  const [shoutouts, setShoutouts] = useState<ShoutoutEntry[] | null>(null);
  const [bannerPickerOpen, setBannerPickerOpen] = useState(false);

  function loadProfile() {
    if (authLoading || !authUser) return;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      apiFetch<{ data: UserProfile }>("/api/me"),
      apiFetch<{ data: PointsData }>("/api/me/points"),
      apiFetch<{ data: ShoutoutEntry[] }>("/api/me/shoutouts").catch(() => ({ data: [] as ShoutoutEntry[] })),
    ]).then(([me, pts, shouts]) => {
      setProfile(me.data);
      setPointsData(pts.data);
      setBioEdit(me.data.bio ?? "");
      setSkillsEdit(me.data.skills ?? []);
      setShoutouts(shouts.data);
    }).catch((err) => {
      setLoadError(err instanceof Error ? err.message : "Failed to load profile");
    }).finally(() => {
      setLoading(false);
    });
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authUser]);

  async function handleProfileSave() {
    setProfileSaving(true);
    setProfileError("");
    try {
      await apiFetch("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ bio: bioEdit, skills: skillsEdit }),
      });
      setProfile((p) => p ? { ...p, bio: bioEdit, skills: skillsEdit } : p);
      setIsEditing(false);
      setSkillInput("");
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setProfileSaving(false);
    }
  }

  function handleCancelEdit() {
    setBioEdit(profile?.bio ?? "");
    setSkillsEdit(profile?.skills ?? []);
    setSkillInput("");
    setProfileError("");
    setIsEditing(false);
  }

  function handleSkillKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = skillInput.trim().replace(/,/g, "");
      if (val && !skillsEdit.includes(val) && skillsEdit.length < 20) {
        setSkillsEdit([...skillsEdit, val]);
      }
      setSkillInput("");
    } else if (e.key === "Backspace" && !skillInput && skillsEdit.length > 0) {
      setSkillsEdit(skillsEdit.slice(0, -1));
    }
  }

  useEffect(() => {
    if (!profile?.department) return;
    apiFetch<{ data: Array<{ rank: number; isCurrentUser: boolean }> }>(
      `/api/leaderboard?departmentId=${profile.department.id}`
    ).then((res) => {
      const me = res.data.find((e) => e.isCurrentUser);
      if (me) setDeptRank({ rank: me.rank, total: res.data.length });
    }).catch((err) => console.error("department rank fetch failed", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.department?.id]);

  useEffect(() => {
    if (activeTab !== "notifications" || notifPrefs !== null) return;
    setNotifLoading(true);
    apiFetch<{ data: Record<string, boolean> }>("/api/me/notification-preferences")
      .then((res) => setNotifPrefs(res.data))
      .catch(() => setNotifError("Failed to load preferences"))
      .finally(() => setNotifLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function handleNotifToggle(type: string, value: boolean) {
    if (!notifPrefs) return;
    const previous = notifPrefs;
    setNotifPrefs({ ...notifPrefs, [type]: value });
    setNotifSaving(type);
    try {
      const res = await apiFetch<{ data: Record<string, boolean> }>(
        "/api/me/notification-preferences",
        { method: "PUT", body: JSON.stringify({ [type]: value }) }
      );
      setNotifPrefs(res.data);
    } catch {
      setNotifPrefs(previous);
      setNotifError("Failed to save preference");
    } finally {
      setNotifSaving(null);
    }
  }

  function selectTab(tab: ProfileTab) {
    setActiveTab(tab);
    setVisibleCount(10);
  }

  async function handleBannerSelect(key: string) {
    setBannerPickerOpen(false);
    await apiFetch("/api/me", { method: "PATCH", body: JSON.stringify({ bannerUrl: key }) });
    setProfile((p) => p ? { ...p, bannerUrl: key } : p);
  }

  return {
    // state
    profile, setProfile,
    pointsData,
    loading,
    loadError,
    activeTab, setActiveTab,
    notifPrefs,
    notifLoading,
    notifSaving,
    notifError,
    visibleCount, setVisibleCount,
    isEditing, setIsEditing,
    bioEdit, setBioEdit,
    skillsEdit, setSkillsEdit,
    skillInput, setSkillInput,
    profileSaving,
    profileError,
    deptRank,
    shoutouts,
    bannerPickerOpen, setBannerPickerOpen,

    // handlers
    loadProfile,
    handleProfileSave,
    handleCancelEdit,
    handleSkillKeyDown,
    handleNotifToggle,
    selectTab,
    handleBannerSelect,
  };
}
