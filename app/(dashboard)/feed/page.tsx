"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Send, ImagePlus, X, MessageCircle, SmilePlus, Trash2, Pencil, Check, PartyPopper, Megaphone, Trophy, BarChart2, Sparkles, Pin, Star, Gamepad2, ShoppingBag } from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { timeAgo, postTimestamp } from "@/lib/helpers/timeAgo";
import { FLAIRS, flairById } from "@/lib/flairs";
import { PostImages } from "@/components/feed/PostImages";
import { ImageLightbox } from "@/components/ImageLightbox";
import { FeedSidebar } from "@/components/feed/FeedSidebar";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";

type PollOption = {
  id: string;
  text: string;
  _count: { votes: number };
};

type FeedPost = {
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

type ReplyItem = {
  id: string;
  content: string;
  createdAt: string;
  parentId: string | null;
  authorId: string;
  author: { displayName: string; avatarUrl: string | null };
};

type CommentItem = {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
  author: { displayName: string; avatarUrl: string | null };
  replies: ReplyItem[];
};

type UserProfile = {
  pointsBalance: number;
  level: number;
  displayName: string;
  department: { id: string; name: string } | null;
};

type LeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  isCurrentUser: boolean;
};


type BirthdayPerson = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  daysUntil: number;
};


function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const EMOJIS = [
  { emoji: "👍", label: "Like" },
  { emoji: "❤️", label: "Love" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "👏", label: "Clap" },
  { emoji: "🎉", label: "Celebrate" },
  { emoji: "💪", label: "Strong" },
];

const EMOJI_BG: Record<string, string> = {
  "👍": "bg-blue-50 text-blue-700 border-blue-200",
  "❤️": "bg-rose-50 text-rose-600 border-rose-200",
  "🔥": "bg-orange-50 text-orange-600 border-orange-200",
  "👏": "bg-amber-50 text-amber-700 border-amber-200",
  "🎉": "bg-purple-50 text-purple-700 border-purple-200",
  "💪": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function ReactionBar({
  postId,
  reactions,
  myReactions,
  onReact,
}: {
  postId: string;
  reactions: Record<string, number>;
  myReactions: string[];
  onReact: (postId: string, emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const myReaction = myReactions[0] ?? null;
  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);

  function openPicker() {
    hoverTimer.current = setTimeout(() => setPickerOpen(true), 350);
  }
  function closePicker() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setPickerOpen(false);
  }
  function handleMainClick() {
    if (myReaction) {
      onReact(postId, myReaction); // toggle off
    } else {
      setPickerOpen((v) => !v);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* React button */}
      <div
        ref={containerRef}
        className="relative"
        onMouseEnter={openPicker}
        onMouseLeave={closePicker}
      >
        {/* Floating picker — pb-2 bridges the gap so mouse doesn't leave container */}
        {pickerOpen && (
          <div className="absolute bottom-full left-0 z-20 pb-2">
            <div className="flex items-center gap-1 bg-white rounded-full shadow-xl border border-gray-100 px-3 py-2.5">
              {EMOJIS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  type="button"
                  title={label}
                  onClick={() => { onReact(postId, emoji); closePicker(); }}
                  className={`text-xl leading-none transition-all duration-150 hover:scale-[1.4] active:scale-110 ${
                    myReaction === emoji ? "scale-125" : ""
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleMainClick}
          aria-haspopup="true"
          aria-expanded={pickerOpen}
          aria-label={myReaction ? `Remove ${EMOJIS.find(e => e.emoji === myReaction)?.label ?? "reaction"}` : "Add reaction"}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            myReaction
              ? "bg-navy-50 border-navy-200 text-navy-700"
              : "bg-white border-gray-200 text-gray-500 hover:border-navy-300 hover:text-navy-600"
          }`}
        >
          {myReaction ? (
            <span className="text-sm leading-none">{myReaction}</span>
          ) : (
            <SmilePlus className="w-3.5 h-3.5" />
          )}
          <span>{myReaction ? EMOJIS.find((e) => e.emoji === myReaction)?.label ?? "Reacted" : "React"}</span>
        </button>
      </div>

      {/* Reaction summary bubbles */}
      {totalReactions > 0 && (
        <div className="flex items-center gap-1.5">
          {Object.entries(reactions)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([emoji, count]) => (
              <span
                key={emoji}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${EMOJI_BG[emoji] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
              >
                {emoji} {count}
              </span>
            ))}
          {totalReactions > 0 && (
            <span className="text-xs text-gray-500 font-medium ml-0.5">
              {totalReactions} {totalReactions === 1 ? "reaction" : "reactions"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const postTypeMeta: Record<string, { bg: string; chip: string; label: string; icon?: React.ElementType }> = {
  CELEBRATION:  { bg: "bg-amber-50 border-amber-200",   chip: "bg-amber-100 text-amber-700",   label: "Celebration", icon: PartyPopper },
  ANNOUNCEMENT: { bg: "bg-navy-50 border-navy-200",     chip: "bg-navy-100 text-navy-700",     label: "Announcement", icon: Megaphone },
  ACHIEVEMENT:  { bg: "bg-violet-50 border-violet-200", chip: "bg-violet-100 text-violet-700", label: "Achievement", icon: Trophy },
  UPDATE:       { bg: "bg-white border-zinc-200",        chip: "",                              label: "" },
  POLL:         { bg: "bg-white border-zinc-200",        chip: "bg-navy-100 text-navy-700",     label: "Poll", icon: BarChart2 },
};

function PollBlock({
  postId,
  options,
  myVoteOptionId,
  voting,
  onVote,
}: {
  postId: string;
  options: PollOption[];
  myVoteOptionId: string | null;
  voting: boolean;
  onVote: (postId: string, optionId: string) => void;
}) {
  const totalVotes = options.reduce((sum, o) => sum + o._count.votes, 0);
  return (
    <div className="mt-3 space-y-2">
      {options.map((opt) => {
        const pct = totalVotes > 0 ? Math.round((opt._count.votes / totalVotes) * 100) : 0;
        const voted = myVoteOptionId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onVote(postId, opt.id)}
            disabled={voting}
            className={`w-full text-left relative overflow-hidden rounded-full border px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed ${
              voted
                ? "border-navy-500 text-navy-800"
                : "border-gray-200 text-gray-700 hover:border-navy-300"
            }`}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: voted ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.07)",
              }}
            />
            <span className="relative flex items-center justify-between gap-2">
              <span className="flex-1 min-w-0 truncate">{opt.text}{voted && <span className="ml-1.5 text-navy-600 text-xs inline-flex items-center gap-0.5"><Check className="w-3 h-3" /> Voted</span>}</span>
              <span className="text-xs text-gray-500 font-normal shrink-0">{pct}% · {opt._count.votes}</span>
            </span>
          </button>
        );
      })}
      <p className="text-xs text-gray-500 pl-1">{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</p>
    </div>
  );
}

function Avatar({ name, url, size = "sm" }: { name: string; url: string | null; size?: "sm" | "md" }) {
  const dim = size === "md" ? "w-12 h-12 text-lg" : "w-10 h-10 text-base";
  if (url) return <img src={url} alt={name} className={`${dim} rounded-full object-cover shrink-0`} />;
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center text-white font-bold shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function FeedPage() {
  const router = useRouter();
  const { user, dbUser, token, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<{ id: string; content: string; postId: string; isReply: boolean; parentId?: string } | null>(null);
  const [editingPost, setEditingPost] = useState<{ id: string; title: string; content: string } | null>(null);
  const [savingPostEdit, setSavingPostEdit] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [pollMode, setPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [shoutoutMode, setShoutoutMode] = useState(false);
  const [shoutoutTitle, setShoutoutTitle] = useState("");
  const [shoutoutDeptOnly, setShoutoutDeptOnly] = useState(false);
  const [recipients, setRecipients] = useState<{ id: string; displayName: string; avatarUrl: string | null }[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientSearchOpen, setRecipientSearchOpen] = useState(false);
  const [votingPost, setVotingPost] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentsCache, setCommentsCache] = useState<Record<string, CommentItem[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [commentSending, setCommentSending] = useState<Record<string, boolean>>({});
  const [replyingTo, setReplyingTo] = useState<{ postId: string; commentId: string; displayName: string } | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replySending, setReplySending] = useState<Record<string, boolean>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [selectedFlair, setSelectedFlair] = useState<string | null>(null);
  const [showAllFlairs, setShowAllFlairs] = useState(false);
  const [deptOnly, setDeptOnly] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionMap, setMentionMap] = useState<Record<string, string>>({});
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const editMentionMapRef = useRef<Record<string, string>>({});
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const recipientSearchRef = useRef<HTMLDivElement>(null);
  const [employees, setEmployees] = useState<{ id: string; displayName: string; avatarUrl: string | null }[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayPerson[]>([]);
  const [widgetsLoading, setWidgetsLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    load(activeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, activeFilter]);

  // Real-time: show banner when someone posts while you're reading
  useRealtimeChannel("feed", () => setHasNewPosts(true));

  useEffect(() => {
    if (authLoading || !user || employees.length > 0) return;
    apiFetch<{ data: { id: string; displayName: string; avatarUrl: string | null }[] }>("/api/employees")
      .then((res) => setEmployees(res.data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    Promise.allSettled([
      apiFetch<{ data: UserProfile }>("/api/me"),
      apiFetch<{ data: LeaderboardEntry[] }>("/api/leaderboard"),
      apiFetch<{ data: BirthdayPerson[] }>("/api/birthdays/upcoming"),
    ]).then(([me, lb, bd]) => {
      if (me.status === "fulfilled") setProfile(me.value.data);
      if (lb.status === "fulfilled") setLeaderboard(lb.value.data ?? []);
      if (bd.status === "fulfilled") setBirthdays((bd.value.data ?? []).filter((b) => b.daysUntil <= 7));
    }).finally(() => setWidgetsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (recipientSearchRef.current && !recipientSearchRef.current.contains(e.target as Node)) {
        setRecipientSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function load(filter = "ALL") {
    setLoading(true);
    setLoadError(null);
    setNextCursor(null);
    try {
      const url = filter === "ALL" ? "/api/feed" : filter === "DEPT_ONLY" ? "/api/feed?dept=mine" : `/api/feed?type=${filter}`;
      const res = await apiFetch<{ data: FeedPost[]; nextCursor: string | null }>(url);
      setPosts(res.data);
      setNextCursor(res.nextCursor);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (activeFilter === "DEPT_ONLY") params.set("dept", "mine");
      else if (activeFilter !== "ALL") params.set("type", activeFilter);
      params.set("cursor", nextCursor);
      const res = await apiFetch<{ data: FeedPost[]; nextCursor: string | null }>(`/api/feed?${params}`);
      setPosts((prev) => [...prev, ...res.data]);
      setNextCursor(res.nextCursor);
    } catch {
      // silently fail — user can click again
    } finally {
      setLoadingMore(false);
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4);
    if (!files.length) return;
    setImageFiles((prev) => {
      const combined = [...prev, ...files].slice(0, 4);
      setImagePreviews(combined.map((f) => URL.createObjectURL(f)));
      return combined;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(imagePreviews[index]);
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function clearImages() {
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImageFiles([]);
    setImagePreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    setPosting(true);
    try {
      let imageUrls: string[] = [];
      if (imageFiles.length > 0) {
        setUploading(true);
        imageUrls = await Promise.all(imageFiles.map((f) => uploadToCloudinary(f, token!)));
        setUploading(false);
      }

      if (shoutoutMode) {
        if (recipients.length === 0 || !newPost.trim()) return;
        await apiFetch("/api/feed", {
          method: "POST",
          body: JSON.stringify({
            type: "SHOUTOUT",
            title: shoutoutTitle.trim() || undefined,
            content: newPost.trim(),
            recipientIds: recipients.map((r) => r.id),
            imageUrls,
            deptOnly: shoutoutDeptOnly,
          }),
        });
        setShoutoutMode(false);
        setRecipients([]); setRecipientSearch(""); setRecipientSearchOpen(false);
        setShoutoutTitle(""); setShoutoutDeptOnly(false);
      } else {
        if (!postTitle.trim() || !newPost.trim() || !selectedFlair) return;
        const content = buildContent(newPost.trim());
        const title = postTitle.trim();
        if (pollMode) {
          const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
          if (opts.length < 2) return;
          await apiFetch("/api/feed", {
            method: "POST",
            body: JSON.stringify({ title, content, type: "POLL", flair: selectedFlair, options: opts, imageUrls, deptOnly }),
          });
          setPollMode(false); setPollOptions(["", ""]);
        } else {
          await apiFetch("/api/feed", {
            method: "POST",
            body: JSON.stringify({ title, content, type: "UPDATE", flair: selectedFlair, imageUrls, deptOnly }),
          });
        }
        setPostTitle(""); setSelectedFlair(null); setDeptOnly(false); setMentionMap({}); setShowAllFlairs(false);
      }

      setNewPost("");
      if (composerRef.current) composerRef.current.style.height = "auto";
      clearImages();
      await load();
    } finally {
      setPosting(false);
      setUploading(false);
    }
  }

  async function handleVote(postId: string, optionId: string) {
    if (votingPost === postId) return;
    setVotingPost(postId);
    const prev = posts.find((p) => p.id === postId);
    if (!prev) return;
    const prevVoteId = prev.myVoteOptionId;

    setPosts((ps) =>
      ps.map((p) => {
        if (p.id !== postId) return p;
        const updatedOptions = p.pollOptions.map((o) => {
          let delta = 0;
          if (o.id === optionId) delta += 1;
          if (prevVoteId && o.id === prevVoteId) delta -= 1;
          return { ...o, _count: { votes: o._count.votes + delta } };
        });
        return { ...p, pollOptions: updatedOptions, myVoteOptionId: optionId };
      })
    );

    try {
      const res = await apiFetch<{ data: { pollOptions: PollOption[]; myVoteOptionId: string } }>(
        `/api/feed/${postId}/vote`,
        { method: "POST", body: JSON.stringify({ optionId }) }
      );
      setPosts((ps) =>
        ps.map((p) =>
          p.id === postId
            ? { ...p, pollOptions: res.data.pollOptions, myVoteOptionId: res.data.myVoteOptionId }
            : p
        )
      );
    } catch {
      setPosts((ps) =>
        ps.map((p) =>
          p.id === postId && prev
            ? { ...p, pollOptions: prev.pollOptions, myVoteOptionId: prev.myVoteOptionId }
            : p
        )
      );
    } finally {
      setVotingPost(null);
    }
  }

  async function toggleComments(postId: string) {
    const next = !openComments[postId];
    setOpenComments((prev) => ({ ...prev, [postId]: next }));
    if (next && !commentsCache[postId]) {
      setCommentsLoading((prev) => ({ ...prev, [postId]: true }));
      try {
        const res = await apiFetch<{ data: CommentItem[] }>(`/api/feed/${postId}/comments`);
        setCommentsCache((prev) => ({ ...prev, [postId]: res.data }));
      } finally {
        setCommentsLoading((prev) => ({ ...prev, [postId]: false }));
      }
    }
  }

  async function submitComment(postId: string) {
    const content = (commentDraft[postId] ?? "").trim();
    if (!content) return;
    setCommentSending((prev) => ({ ...prev, [postId]: true }));
    const optimisticId = `opt-${Date.now()}`;
    const optimistic: CommentItem = {
      id: optimisticId,
      content,
      createdAt: new Date().toISOString(),
      author: { displayName: user?.displayName ?? "You", avatarUrl: user?.photoURL ?? null },
      replies: [],
    };
    setCommentsCache((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), optimistic] }));
    setCommentDraft((prev) => ({ ...prev, [postId]: "" }));
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)));
    try {
      const res = await apiFetch<{ data: CommentItem }>(`/api/feed/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setCommentsCache((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map((c) => (c.id === optimisticId ? res.data : c)),
      }));
    } catch {
      setCommentsCache((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).filter((c) => c.id !== optimisticId),
      }));
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p)));
      setCommentDraft((prev) => ({ ...prev, [postId]: content }));
    } finally {
      setCommentSending((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function submitReply(postId: string, parentId: string) {
    const content = (replyDraft[parentId] ?? "").trim();
    if (!content) return;
    setReplySending((prev) => ({ ...prev, [parentId]: true }));
    const optimisticId = `opt-reply-${Date.now()}`;
    const optimistic: ReplyItem = {
      id: optimisticId,
      content,
      createdAt: new Date().toISOString(),
      parentId,
      author: { displayName: user?.displayName ?? "You", avatarUrl: user?.photoURL ?? null },
    };
    setCommentsCache((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? []).map((c) =>
        c.id === parentId ? { ...c, replies: [...c.replies, optimistic] } : c
      ),
    }));
    setReplyDraft((prev) => ({ ...prev, [parentId]: "" }));
    setReplyingTo(null);
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)));
    try {
      const res = await apiFetch<{ data: ReplyItem }>(`/api/feed/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content, parentId }),
      });
      setCommentsCache((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map((c) =>
          c.id === parentId
            ? { ...c, replies: c.replies.map((r) => (r.id === optimisticId ? res.data : r)) }
            : c
        ),
      }));
    } catch {
      setCommentsCache((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map((c) =>
          c.id === parentId ? { ...c, replies: c.replies.filter((r) => r.id !== optimisticId) } : c
        ),
      }));
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p)));
      setReplyDraft((prev) => ({ ...prev, [parentId]: content }));
    } finally {
      setReplySending((prev) => ({ ...prev, [parentId]: false }));
    }
  }

  async function deleteComment(postId: string, commentId: string, parentId?: string) {
    if (!confirm("Delete this comment?")) return;
    const previousCache = commentsCache;
    const previousPosts = posts;
    if (parentId) {
      setCommentsCache((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map((c) =>
          c.id === parentId ? { ...c, replies: c.replies.filter((r) => r.id !== commentId) } : c
        ),
      }));
    } else {
      setCommentsCache((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).filter((c) => c.id !== commentId),
      }));
    }
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p)));
    try {
      await apiFetch(`/api/feed/${postId}/comments/${commentId}`, { method: "DELETE" });
    } catch {
      setCommentsCache(previousCache);
      setPosts(previousPosts);
    }
  }

  async function saveEditComment(postId: string) {
    if (!editingComment) return;
    const { id, content, isReply, parentId } = editingComment;
    const trimmed = content.trim();
    if (!trimmed) return;

    if (isReply && parentId) {
      setCommentsCache((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map((c) =>
          c.id === parentId
            ? { ...c, replies: c.replies.map((r) => (r.id === id ? { ...r, content: trimmed } : r)) }
            : c
        ),
      }));
    } else {
      setCommentsCache((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map((c) => (c.id === id ? { ...c, content: trimmed } : c)),
      }));
    }
    setEditingComment(null);
    await apiFetch(`/api/feed/${postId}/comments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ content: trimmed }),
    });
  }

  // Turn stored "@[Name|id]" tokens back into "@Name" for editing, keeping a name→id map
  function decodeMentions(content: string): { text: string; map: Record<string, string> } {
    const map: Record<string, string> = {};
    const text = content.replace(/@\[([^|]+)\|([^\]]+)\]/g, (_m, name, id) => {
      map[name] = id;
      return `@${name}`;
    });
    return { text, map };
  }

  // Re-apply the "@Name" → "@[Name|id]" encoding after an edit
  function encodeMentions(text: string, map: Record<string, string>): string {
    const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
    let result = text;
    for (const [name, id] of entries) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`@${escaped}`, "g"), `@[${name}|${id}]`);
    }
    return result;
  }

  function startEditPost(post: FeedPost) {
    const { text, map } = decodeMentions(post.content);
    editMentionMapRef.current = map;
    setEditingPost({ id: post.id, title: post.title ?? "", content: text });
  }

  async function saveEditPost(post: FeedPost) {
    if (!editingPost) return;
    const trimmedContent = editingPost.content.trim();
    if (!trimmedContent) return;
    const isShoutout = post.type === "SHOUTOUT";
    const trimmedTitle = editingPost.title.trim();
    if (!isShoutout && !trimmedTitle) return; // title is required on non-shoutout posts

    setSavingPostEdit(true);
    const encoded = encodeMentions(trimmedContent, editMentionMapRef.current);
    const newTitle = isShoutout ? null : trimmedTitle;

    // Optimistic update
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, title: newTitle, content: encoded } : p)));
    setEditingPost(null);
    try {
      await apiFetch(`/api/feed/${post.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: newTitle, content: encoded }),
      });
    } catch {
      await load(activeFilter);
    } finally {
      setSavingPostEdit(false);
    }
  }

  async function deletePost(postId: string) {
    if (!confirm("Delete this post?")) return;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await apiFetch(`/api/feed/${postId}`, { method: "DELETE" });
    } catch {
      await load();
    }
  }

  async function togglePin(postId: string) {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const newPinned = !post.isPinned;
    setPosts((prev) => {
      const updated = prev.map((p) => p.id === postId ? { ...p, isPinned: newPinned } : p);
      return [...updated.filter((p) => p.isPinned), ...updated.filter((p) => !p.isPinned)];
    });
    try {
      await apiFetch(`/api/feed/${postId}`, { method: "PATCH" });
    } catch {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, isPinned: !newPinned } : p));
    }
  }

  function jumpToPost(id: string) {
    const el = document.getElementById(`feed-post-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-amber-300");
      setTimeout(() => el.classList.remove("ring-2", "ring-amber-300"), 1600);
    }
  }

  const pinnedItems = posts
    .filter((p) => p.isPinned)
    .map((p) => ({ id: p.id, title: p.title, authorName: p.author.displayName }));

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  function handleComposerChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setNewPost(value);
    autoResize(e.target);
    const cursor = e.target.selectionStart ?? value.length;
    const textUpToCursor = value.slice(0, cursor);
    // Allow spaces in names; stop only at another @ or an already-resolved mention (@[)
    const match = textUpToCursor.match(/@(?!\[)([^@]*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase().trim());
      setMentionStart(cursor - match[0].length);
    } else {
      setMentionQuery(null);
    }
  }

  function insertMention(emp: { id: string; displayName: string }) {
    const cursor = composerRef.current?.selectionStart ?? newPost.length;
    const before = newPost.slice(0, mentionStart);
    const after = newPost.slice(cursor);
    // Store human-readable @Name in textarea; track id separately
    setNewPost(`${before}@${emp.displayName} ${after.trimStart()}`);
    setMentionMap((prev) => ({ ...prev, [emp.displayName]: emp.id }));
    setMentionQuery(null);
    setTimeout(() => composerRef.current?.focus(), 0);
  }

  function buildContent(text: string): string {
    // Replace @Name → @[Name|id] sorted longest-first to avoid partial matches
    const entries = Object.entries(mentionMap).sort((a, b) => b[0].length - a[0].length);
    let result = text;
    for (const [name, id] of entries) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`@${escaped}`, "g"), `@[${name}|${id}]`);
    }
    return result;
  }

  function renderContent(content: string) {
    const parts = content.split(/(@\[[^\|]+\|[^\]]+\])/g);
    return (
      <>
        {parts.map((part, i) => {
          const match = part.match(/^@\[([^\|]+)\|([^\]]+)\]$/);
          if (match) {
            const [, name, id] = match;
            return (
              <button
                key={i}
                type="button"
                onClick={() => router.push(`/employees/${id}`)}
                className="font-semibold text-blue-600 bg-blue-50 rounded-md px-1 py-0.5 hover:bg-blue-100 transition-colors cursor-pointer"
              >
                @{name}
              </button>
            );
          }
          return <React.Fragment key={i}>{part}</React.Fragment>;
        })}
      </>
    );
  }

  const mentionResults = mentionQuery !== null
    ? employees
        .filter((e) => mentionQuery === "" || e.displayName.toLowerCase().includes(mentionQuery))
        .slice(0, 6)
    : [];

  async function toggleReaction(postId: string, emoji: string) {
    const previousPosts = posts;
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const current = p.myReactions[0] ?? null;
        const newReactions = { ...p.reactions };

        // Remove old reaction count
        if (current) {
          newReactions[current] = (newReactions[current] ?? 1) - 1;
          if (newReactions[current] <= 0) delete newReactions[current];
        }

        if (current === emoji) {
          // Toggle off
          return { ...p, reactions: newReactions, myReactions: [] };
        } else {
          // Switch to new emoji
          newReactions[emoji] = (newReactions[emoji] ?? 0) + 1;
          return { ...p, reactions: newReactions, myReactions: [emoji] };
        }
      })
    );

    try {
      await apiFetch(`/api/feed/${postId}/react`, { method: "POST", body: JSON.stringify({ emoji }) });
    } catch {
      setPosts(previousPosts);
    }
  }

  const firstName = user?.displayName?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <p className="text-sm text-zinc-500 font-medium">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="text-2xl font-bold text-zinc-900 mt-0.5">
          {authLoading ? (
            <span className="inline-block h-8 w-48 bg-zinc-100 animate-pulse rounded align-middle" />
          ) : (
            <>{getGreeting()}, {firstName}</>
          )}
        </h1>
      </div>

      {hasNewPosts && (
        <button
          onClick={() => { setHasNewPosts(false); load(activeFilter); }}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          New posts — click to refresh
        </button>
      )}

      {/* Two-column layout: compose+posts (left), sidebar (right). Stacks on mobile. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_1fr] items-start">

        {/* Sidebar — right column on desktop (spans both rows), first on mobile */}
        <aside className="order-1 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-8 space-y-4">

          {/* My Stats */}
          <div className="bg-white rounded-xl border border-zinc-100 p-4">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">My Stats</p>
            {widgetsLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-8 bg-zinc-100 rounded w-1/2" />
                <div className="h-3 bg-zinc-100 rounded w-1/3" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-3xl font-black text-zinc-900 tabular-nums leading-none">
                    {profile?.pointsBalance?.toLocaleString() ?? "—"}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">points available</p>
                </div>
                <div className="flex items-center gap-4 pt-1 border-t border-zinc-50">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    <span className="text-sm font-bold text-violet-600">Lv {profile?.level ?? 1}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Feed Filters + Pinned */}
          <FeedSidebar
            activeFilter={activeFilter}
            onFilterChange={(value) => { setActiveFilter(value); setPosts([]); setNextCursor(null); }}
            pinned={pinnedItems}
            onJumpToPost={jumpToPost}
          />

          {/* Upcoming Birthdays */}
          {!widgetsLoading && birthdays.length > 0 && (
            <div className="bg-gradient-to-br from-pink-50 to-violet-50 border border-pink-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-pink-500 uppercase tracking-wider mb-2.5">🎂 Birthdays</p>
              <div className="space-y-2">
                {birthdays.map((b) => (
                  <Link key={b.id} href={`/employees/${b.id}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <Avatar name={b.displayName} url={b.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-zinc-900 truncate hover:underline">{b.displayName}</p>
                      <p className="text-[10px] text-zinc-500">
                        {b.daysUntil === 0 ? "Today 🎉" : b.daysUntil === 1 ? "Tomorrow" : `In ${b.daysUntil} days`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Top Performers */}
          <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-50">
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-xs font-semibold text-zinc-700">Top Performers</span>
              </div>
              <Link href="/leaderboard" className="text-xs text-navy-600 hover:text-navy-700 font-medium">See all →</Link>
            </div>
            {widgetsLoading ? (
              <div className="p-4 space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-zinc-100 rounded" />)}
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-6">No data yet</p>
            ) : (
              <div>
                {leaderboard.slice(0, 5).map((entry) => (
                  <div key={entry.userId} className={`flex items-center gap-2.5 px-4 py-2.5 ${entry.isCurrentUser ? "bg-navy-50/50" : "hover:bg-zinc-50/60"} transition-colors`}>
                    <Link href={`/employees/${entry.userId}`}>
                      <Avatar name={entry.displayName} url={entry.avatarUrl} size="sm" />
                    </Link>
                    <Link href={`/employees/${entry.userId}`} className={`text-xs font-medium truncate flex-1 min-w-0 hover:underline ${entry.isCurrentUser ? "text-navy-700 font-semibold" : "text-zinc-700"}`}>
                      {entry.isCurrentUser ? `${entry.displayName} (You)` : entry.displayName}
                    </Link>
                    <span className="text-xs font-bold tabular-nums text-zinc-500 shrink-0">
                      {entry.points.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Link href="/minigames" className="flex flex-col items-center gap-1.5 bg-white border border-zinc-100 rounded-xl py-3 px-2 hover:border-zinc-200 hover:shadow-sm transition-all text-center">
              <Gamepad2 className="w-5 h-5 text-violet-500" />
              <span className="text-xs font-semibold text-zinc-700 leading-tight">Play a<br/>Minigame</span>
            </Link>
            <Link href="/marketplace" className="flex flex-col items-center gap-1.5 bg-white border border-zinc-100 rounded-xl py-3 px-2 hover:border-zinc-200 hover:shadow-sm transition-all text-center">
              <ShoppingBag className="w-5 h-5 text-orange-400" />
              <span className="text-xs font-semibold text-zinc-700 leading-tight">Redeem<br/>Points</span>
            </Link>
          </div>

        </aside>

        {/* Compose — left column, row 1 */}
        <div className="order-2 lg:order-none lg:col-start-1 lg:row-start-1">
      {/* Compose */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4">
        <form onSubmit={handlePost} className="space-y-3">
          <div className="flex items-start gap-3">
            <Avatar name={user?.displayName ?? "?"} url={user?.photoURL ?? null} size="md" />
            <div className="flex-1 relative space-y-2">
              {!shoutoutMode && (
                <input
                  type="text"
                  placeholder="Title *"
                  aria-label="Post title"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  maxLength={120}
                  className="w-full text-sm font-semibold bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:text-zinc-500 placeholder:font-normal transition-all"
                />
              )}
              {shoutoutMode && (
                <div ref={recipientSearchRef} className="space-y-1.5">
                  {recipients.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {recipients.map((r) => (
                        <div key={r.id} className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full pl-1.5 pr-2 py-0.5">
                          <Avatar name={r.displayName} url={r.avatarUrl} size="sm" />
                          <span className="text-xs font-medium text-amber-800">{r.displayName}</span>
                          <button type="button" onClick={() => setRecipients((prev) => prev.filter((x) => x.id !== r.id))} className="text-amber-400 hover:text-amber-600 transition-colors ml-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <input
                      type="text"
                      value={recipientSearch}
                      onChange={(e) => { setRecipientSearch(e.target.value); setRecipientSearchOpen(true); }}
                      onFocus={() => setRecipientSearchOpen(true)}
                      placeholder={recipients.length === 0 ? "Who are you recognizing?…" : "Add another person…"}
                      className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 placeholder:text-zinc-500 transition-all"
                    />
                    {recipientSearchOpen && (
                      <div role="listbox" aria-label="Select recipient" className="absolute z-30 top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {employees
                          .filter((e) => !recipients.some((r) => r.id === e.id) && (!recipientSearch || e.displayName.toLowerCase().includes(recipientSearch.toLowerCase())))
                          .slice(0, 8)
                          .map((e) => (
                            <button key={e.id} type="button"
                              role="option" aria-selected={false}
                              onMouseDown={(ev) => { ev.preventDefault(); setRecipients((prev) => [...prev, { id: e.id, displayName: e.displayName, avatarUrl: e.avatarUrl }]); setRecipientSearch(""); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-amber-50 text-left transition-colors">
                              <Avatar name={e.displayName} url={e.avatarUrl} size="sm" />
                              <span className="text-sm font-medium text-gray-900">{e.displayName}</span>
                            </button>
                          ))}
                        {employees.filter((e) => !recipients.some((r) => r.id === e.id) && (!recipientSearch || e.displayName.toLowerCase().includes(recipientSearch.toLowerCase()))).length === 0 && (
                          <p className="px-3 py-2 text-sm text-zinc-500">{recipientSearch ? "No results" : "All employees added"}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {shoutoutMode && (
                <input
                  type="text"
                  placeholder="Recognition title (optional)"
                  value={shoutoutTitle}
                  onChange={(e) => setShoutoutTitle(e.target.value)}
                  maxLength={120}
                  className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 placeholder:text-zinc-500 transition-all"
                />
              )}
              <textarea
                ref={composerRef}
                placeholder={shoutoutMode ? "What did they do that deserves recognition?" : "Share something with the team… (type @ to mention)"}
                aria-label="Post content"
                value={newPost}
                onChange={handleComposerChange}
                rows={2}
                className="w-full resize-none overflow-hidden text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:text-zinc-500 transition-all"
              />
              {mentionQuery !== null && mentionResults.length > 0 && (
                <div
                  ref={mentionDropdownRef}
                  role="listbox"
                  aria-label="Mention an employee"
                  className="absolute z-30 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
                >
                  {mentionResults.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(e) => { e.preventDefault(); insertMention(emp); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 transition-colors text-left"
                    >
                      <Avatar name={emp.displayName} url={emp.avatarUrl} size="sm" />
                      <span className="text-sm font-medium text-gray-900">{emp.displayName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Image previews — mirrors PostImages layout */}
          {imagePreviews.length > 0 && (() => {
            const gridClass = imagePreviews.length === 2 ? "grid grid-cols-2 gap-1" : "grid grid-cols-3 gap-1";
            const containerWidth = imagePreviews.length === 1 ? "w-[40%]" : imagePreviews.length === 2 ? "w-[80%]" : "w-full";
            return (
              <div className={`${containerWidth} ${gridClass}`}>
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative group w-full aspect-square rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Preview ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-gray-900/70 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Flair picker */}
          {!shoutoutMode && <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Flair <span className="text-red-400 font-bold">*</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(showAllFlairs ? FLAIRS : FLAIRS.slice(0, 8)).map((flair) => (
                <button
                  key={flair.id}
                  type="button"
                  onClick={() => setSelectedFlair(flair.id === selectedFlair ? null : flair.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border transition-all ${
                    selectedFlair === flair.id
                      ? `${flair.color} scale-105 shadow-sm`
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span>{flair.emoji}</span>
                  <span>{flair.label}</span>
                </button>
              ))}
              {!showAllFlairs && (
                <button
                  type="button"
                  onClick={() => setShowAllFlairs(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-all"
                >
                  +{FLAIRS.length - 8} more
                </button>
              )}
            </div>
          </div>}

          {!shoutoutMode && dbUser?.department && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-medium shrink-0">Visible to:</span>
              <div className="flex items-center gap-1 p-0.5 bg-zinc-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDeptOnly(false)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    !deptOnly ? "bg-white text-zinc-800 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  Everyone
                </button>
                <button
                  type="button"
                  onClick={() => setDeptOnly(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    deptOnly ? "bg-white text-navy-700 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  <span>🏢</span>
                  {dbUser.department.name} only
                </button>
              </div>
            </div>
          )}
          {shoutoutMode && dbUser?.department && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-medium shrink-0">Visible to:</span>
              <div className="flex items-center gap-1 p-0.5 bg-zinc-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setShoutoutDeptOnly(false)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    !shoutoutDeptOnly ? "bg-white text-zinc-800 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  Everyone
                </button>
                <button
                  type="button"
                  onClick={() => setShoutoutDeptOnly(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    shoutoutDeptOnly ? "bg-white text-amber-700 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  <span>🏢</span>
                  {dbUser.department.name} only
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageFiles.length >= 4}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all bg-white border-gray-200 text-gray-600 hover:border-navy-300 hover:text-navy-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              {imageFiles.length > 0 ? `${imageFiles.length}/4 photos` : "Photo"}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !pollMode;
                setPollMode(next);
                if (next) { setShoutoutMode(false); setRecipients([]); setRecipientSearch(""); }
                if (!next) setPollOptions(["", ""]);
              }}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                pollMode
                  ? "bg-[#111827] border-[#111827] text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-navy-300 hover:text-navy-600"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" /> Add Poll
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !shoutoutMode;
                setShoutoutMode(next);
                if (next) { setPollMode(false); setPollOptions(["", ""]); }
                else { setRecipients([]); setRecipientSearch(""); setShoutoutTitle(""); setShoutoutDeptOnly(false); }
              }}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                shoutoutMode
                  ? "bg-amber-500 border-amber-500 text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-600"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Shoutout
            </button>
          </div>

          {pollMode && (
            <div className="space-y-2 pl-1">
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) =>
                      setPollOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
                    }
                    className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 transition-all"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}
                      className="text-gray-500 hover:text-red-500 text-sm transition-colors"
                      aria-label="Remove option"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button
                  type="button"
                  onClick={() => setPollOptions((prev) => [...prev, ""])}
                  className="text-xs text-navy-600 hover:text-navy-800 font-medium transition-colors"
                >
                  + Add option
                </button>
              )}
            </div>
          )}

          {(shoutoutMode ? recipients.length > 0 : (newPost.trim() || imageFiles.length > 0)) && (
            <div className="flex items-center justify-between">
              {shoutoutMode
                ? (recipients.length === 0 && <p className="text-xs text-red-400 font-medium">Choose a colleague to recognize</p>)
                : ((!postTitle.trim() || !selectedFlair) && (
                    <p className="text-xs text-red-400 font-medium">
                      {!postTitle.trim() ? "Add a title before posting" : "Pick a flair before posting"}
                    </p>
                  ))
              }
              <div className="ml-auto">
                <button
                  type="submit"
                  disabled={posting || (shoutoutMode ? recipients.length === 0 || !newPost.trim() : !postTitle.trim() || !selectedFlair || (pollMode && pollOptions.filter((o) => o.trim()).length < 2))}
                  className="flex items-center gap-2 bg-[#111827] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  {uploading ? "Uploading…" : posting ? "Posting…" : shoutoutMode ? "Send Shoutout" : "Post"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
        </div>

        {/* Posts — left column, row 2 */}
        <div className="order-3 lg:order-none lg:col-start-1 lg:row-start-2 space-y-5 ">
      {/* Posts */}
      {loadError ? (
        <div role="alert" className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <p className="text-red-600 font-medium text-sm">{loadError}</p>
          <button onClick={() => load()} className="mt-3 text-xs text-red-500 underline hover:text-red-700">Try again</button>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 p-5 animate-pulse">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <div className="mb-4 flex items-center justify-center"><Megaphone className="w-10 h-10 text-gray-300" /></div>
          <p className="text-gray-600 font-medium">No posts yet</p>
          <p className="text-gray-500 text-sm mt-1">Award points to an employee to generate the first post!</p>
        </div>
      ) : (
        posts.map((post) => {
          if (post.type === "SHOUTOUT" && post.shoutoutRecipients.length > 0) {
            return (
              <div id={`feed-post-${post.id}`} key={post.id} className={`bg-white rounded-xl border overflow-hidden transition-shadow hover:shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300 ${post.isPinned ? "border-amber-300 hover:border-amber-400" : "border-zinc-200 hover:border-zinc-300"}`}>
                <div className="h-1.5 bg-gradient-to-r from-amber-400 to-yellow-300" />
                <div className="px-5 py-4 space-y-3">
                  {post.isPinned && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                      <Pin className="w-3 h-3" /> Pinned
                    </div>
                  )}

                  {/* Sender row */}
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => router.push(`/employees/${post.authorId}`)} className="shrink-0 hover:opacity-80 transition-opacity">
                      <Avatar name={post.author.displayName} url={post.author.avatarUrl} size="sm" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => router.push(`/employees/${post.authorId}`)} className="font-semibold text-sm text-zinc-800 hover:underline whitespace-nowrap min-w-0 truncate">
                          {post.author.displayName}
                        </button>
                        <div className="ml-auto shrink-0 flex items-center gap-1">
                          <span className="text-xs text-zinc-500 whitespace-nowrap">{postTimestamp(post.createdAt)}</span>
                          {(dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN") && (
                            <button onClick={() => togglePin(post.id)} className={`p-1 rounded-lg transition-colors ${post.isPinned ? "text-amber-500 hover:text-amber-700 hover:bg-amber-50" : "text-gray-400 hover:text-amber-500 hover:bg-amber-50"}`} title={post.isPinned ? "Unpin post" : "Pin post"}>
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(post.authorId === dbUser?.id || dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN") && (
                            <>
                              <button onClick={() => startEditPost(post)} className="text-gray-400 hover:text-navy-500 transition-colors p-1 rounded-lg hover:bg-navy-50" title="Edit shoutout">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => deletePost(post.id)} className="text-gray-400 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-50" title="Delete post">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {post.author.department && (
                        <span className="text-xs text-zinc-500 font-medium block">{post.author.department.name}</span>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-amber-200" />
                    <span className="text-xs font-semibold text-amber-600 flex items-center gap-1 shrink-0">
                      <Sparkles className="w-3.5 h-3.5" /> gave a shoutout to
                    </span>
                    <div className="h-px flex-1 bg-amber-200" />
                  </div>

                  {/* Title + department badge */}
                  {(post.title || post.department) && (
                    <div className="flex flex-col items-center gap-1.5">
                      {post.title && (
                        <p className="text-sm font-bold text-amber-800 text-center">{post.title}</p>
                      )}
                      {post.department && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          🏢 {post.department.name} only
                        </span>
                      )}
                    </div>
                  )}

                  {/* Recipients + message */}
                  {editingPost?.id === post.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingPost.content}
                        onChange={(e) => { setEditingPost((prev) => (prev ? { ...prev, content: e.target.value } : prev)); autoResize(e.target); }}
                        rows={3}
                        maxLength={500}
                        className="w-full resize-none overflow-hidden text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 placeholder:text-zinc-500 transition-all"
                      />
                      <div className="flex items-center gap-2">
                        <button onClick={() => saveEditPost(post)} disabled={savingPostEdit || !editingPost.content.trim()} className="flex items-center gap-1.5 bg-[#111827] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button onClick={() => setEditingPost(null)} className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1.5 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : post.shoutoutRecipients.length === 1 ? (
                    <>
                      <div className="flex gap-3 items-start">
                        <button type="button" onClick={() => router.push(`/employees/${post.shoutoutRecipients[0].user.id}`)} className="shrink-0 hover:opacity-80 transition-opacity">
                          <Avatar name={post.shoutoutRecipients[0].user.displayName} url={post.shoutoutRecipients[0].user.avatarUrl} size="md" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <button type="button" onClick={() => router.push(`/employees/${post.shoutoutRecipients[0].user.id}`)} className="font-bold text-base text-zinc-900 hover:underline block">
                            {post.shoutoutRecipients[0].user.displayName}
                          </button>
                          <p className="text-sm text-zinc-600 italic mt-1 leading-relaxed whitespace-pre-wrap">&ldquo;{renderContent(post.content)}&rdquo;</p>
                        </div>
                      </div>
                      {post.imageUrls?.length > 0 && (
                        <PostImages urls={post.imageUrls} authorName={post.author.displayName} onOpen={(index) => setLightbox({ images: post.imageUrls, index })} />
                      )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {post.shoutoutRecipients.map((r) => (
                          <button key={r.user.id} type="button" onClick={() => router.push(`/employees/${r.user.id}`)} className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-full pl-0.5 pr-2.5 py-0.5 hover:bg-amber-100 transition-colors">
                            <Avatar name={r.user.displayName} url={r.user.avatarUrl} size="sm" />
                            <span className="text-xs font-semibold text-amber-900">{r.user.displayName}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-sm text-zinc-600 italic leading-relaxed whitespace-pre-wrap">&ldquo;{renderContent(post.content)}&rdquo;</p>
                      {post.imageUrls?.length > 0 && (
                        <PostImages urls={post.imageUrls} authorName={post.author.displayName} onOpen={(index) => setLightbox({ images: post.imageUrls, index })} />
                      )}
                    </div>
                  )}
                  <div className="pt-2 border-t border-black/5 flex items-center justify-between gap-3 flex-wrap">
                    <ReactionBar
                      postId={post.id}
                      reactions={post.reactions}
                      myReactions={post.myReactions}
                      onReact={toggleReaction}
                    />
                    <button
                      onClick={() => toggleComments(post.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        openComments[post.id]
                          ? "bg-navy-50 border-navy-200 text-navy-700"
                          : "bg-white border-gray-200 text-gray-500 hover:border-navy-300 hover:text-navy-600"
                      }`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
                    </button>
                  </div>
                  {openComments[post.id] && (
                    <div className="mt-1 pt-3 border-t border-black/5 space-y-4">
                      {commentsLoading[post.id] && (
                        <div className="space-y-3 animate-pulse">
                          {[1, 2].map((i) => (
                            <div key={i} className="flex gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-zinc-100 shrink-0" />
                              <div className="flex-1 space-y-1.5">
                                <div className="h-3 bg-zinc-100 rounded w-1/4" />
                                <div className="h-3 bg-zinc-100 rounded w-3/4" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {!commentsLoading[post.id] && (commentsCache[post.id] ?? []).map((c) => (
                        <div key={c.id}>
                          <div className="flex gap-2.5">
                            <Avatar name={c.author.displayName} url={c.author.avatarUrl} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="bg-gray-50 rounded-2xl px-3.5 py-2.5">
                                <span className="text-xs font-semibold text-gray-900">{c.author.displayName}</span>
                                <p className="text-sm text-gray-700 mt-0.5 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                              </div>
                              <div className="flex items-center gap-3 mt-1 pl-1">
                                <span className="text-[11px] text-gray-500">{timeAgo(c.createdAt)}</span>
                                <button
                                  onClick={() =>
                                    setReplyingTo(
                                      replyingTo?.commentId === c.id
                                        ? null
                                        : { postId: post.id, commentId: c.id, displayName: c.author.displayName }
                                    )
                                  }
                                  className="text-[11px] font-semibold text-gray-500 hover:text-navy-600 transition-colors"
                                >
                                  Reply
                                </button>
                                {(c.authorId === dbUser?.id || dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN") && (
                                  <button
                                    onClick={() => deleteComment(post.id, c.id)}
                                    className="text-[11px] font-semibold text-gray-500 hover:text-red-500 transition-colors"
                                  >
                                    Delete
                                  </button>
                                )}
                                {c.replies.length > 0 && (
                                  <button
                                    onClick={() => setExpandedReplies((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                                    className="text-[11px] font-semibold text-navy-500 hover:text-navy-700 transition-colors"
                                  >
                                    {expandedReplies[c.id]
                                      ? "Hide replies"
                                      : `View ${c.replies.length} ${c.replies.length === 1 ? "reply" : "replies"}`}
                                  </button>
                                )}
                              </div>
                              {replyingTo?.commentId === c.id && (
                                <div className="flex gap-2 mt-2">
                                  <Avatar name={user?.displayName ?? "?"} url={user?.photoURL ?? null} size="sm" />
                                  <div className="flex-1 flex gap-2">
                                    <textarea
                                      autoFocus
                                      rows={1}
                                      placeholder={`Reply to ${c.author.displayName}…`}
                                      value={replyDraft[c.id] ?? ""}
                                      onChange={(e) => { setReplyDraft((prev) => ({ ...prev, [c.id]: e.target.value })); autoResize(e.target); }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Escape") setReplyingTo(null);
                                      }}
                                      className="flex-1 text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 transition-all resize-none overflow-hidden"
                                    />
                                    <button
                                      onClick={() => submitReply(post.id, c.id)}
                                      disabled={replySending[c.id] || !(replyDraft[c.id] ?? "").trim()}
                                      aria-label="Submit comment"
                                      className="flex items-center justify-center w-8 h-8 bg-[#111827] text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 shrink-0"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                              {expandedReplies[c.id] && c.replies.length > 0 && (
                                <div className="mt-2 space-y-2 pl-2 border-l-2 border-gray-100">
                                  {c.replies.map((r) => (
                                    <div key={r.id} className="flex gap-2">
                                      <Avatar name={r.author.displayName} url={r.author.avatarUrl} size="sm" />
                                      <div className="flex-1 min-w-0">
                                        <div className="bg-gray-50 rounded-2xl px-3.5 py-2.5">
                                          <span className="text-xs font-semibold text-gray-900">{r.author.displayName}</span>
                                          <p className="text-sm text-gray-700 mt-0.5 leading-relaxed whitespace-pre-wrap">{r.content}</p>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 pl-1">
                                          <span className="text-[11px] text-gray-500">{timeAgo(r.createdAt)}</span>
                                          {(r.authorId === dbUser?.id || dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN") && (
                                            <button
                                              onClick={() => deleteComment(post.id, r.id, c.id)}
                                              className="text-[11px] font-semibold text-gray-500 hover:text-red-500 transition-colors"
                                            >
                                              Delete
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2.5 items-center pt-1">
                        <Avatar name={user?.displayName ?? "?"} url={user?.photoURL ?? null} size="sm" />
                        <div className="flex-1 flex gap-2">
                          <textarea
                            rows={1}
                            placeholder="Write a comment…"
                            value={commentDraft[post.id] ?? ""}
                            onChange={(e) => { setCommentDraft((prev) => ({ ...prev, [post.id]: e.target.value })); autoResize(e.target); }}
                            className="flex-1 text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 transition-all resize-none overflow-hidden"
                          />
                          <button
                            onClick={() => submitComment(post.id)}
                            disabled={commentSending[post.id] || !(commentDraft[post.id] ?? "").trim()}
                            aria-label="Submit comment"
                            className="flex items-center justify-center w-8 h-8 bg-[#111827] text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 shrink-0"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          const meta = postTypeMeta[post.type] ?? postTypeMeta.UPDATE;
          return (
            <div id={`feed-post-${post.id}`} key={post.id} className={`rounded-xl border overflow-hidden transition-shadow hover:shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300 ${post.isPinned ? "border-amber-300 hover:border-amber-400 bg-amber-50/30" : `${meta.bg} hover:border-zinc-300`}`}>
              <div className="p-5">
                {/* Pinned indicator */}
                {post.isPinned && (
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 mb-2">
                    <Pin className="w-3 h-3" /> Pinned
                  </div>
                )}

                {/* Flair + structural type chips */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {(() => {
                    const flair = flairById[post.flair ?? "CASUAL"] ?? flairById["CASUAL"];
                    return (
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${flair.color}`}>
                        <span>{flair.emoji}</span>
                        <span>{flair.label}</span>
                      </span>
                    );
                  })()}
                  {post.type === "POLL" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-navy-100 text-navy-700">
                      <BarChart2 className="w-3 h-3" /> Poll
                    </span>
                  )}
                  {post.department && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-navy-100 text-navy-700 border border-navy-200">
                      🏢 {post.department.name} only
                    </span>
                  )}
                </div>

                {/* Author row */}
                <div className="flex items-start gap-3">
                  <button type="button" onClick={() => router.push(`/employees/${post.authorId}`)} className="shrink-0 hover:opacity-80 transition-opacity">
                    <Avatar name={post.author.displayName} url={post.author.avatarUrl} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => router.push(`/employees/${post.authorId}`)} className="font-semibold text-sm text-gray-900 hover:underline transition-colors whitespace-nowrap min-w-0 truncate">
                        {post.author.displayName}
                      </button>
                      <div className="ml-auto shrink-0 flex items-center gap-1">
                        <span className="text-xs text-gray-500 whitespace-nowrap">{postTimestamp(post.createdAt)}</span>
                        {dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN" && (
                          <button
                            onClick={() => togglePin(post.id)}
                            className={`p-1 rounded-lg transition-colors ${post.isPinned ? "text-amber-500 hover:text-amber-700 hover:bg-amber-100" : "text-gray-400 hover:text-amber-500 hover:bg-amber-50"}`}
                            title={post.isPinned ? "Unpin post" : "Pin post"}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(post.authorId === dbUser?.id || dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN") && (
                          <>
                            <button
                              onClick={() => startEditPost(post)}
                              className="text-gray-400 hover:text-navy-500 transition-colors p-1 rounded-lg hover:bg-navy-50"
                              title="Edit post"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deletePost(post.id)}
                              className="text-gray-400 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-50"
                              title="Delete post"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {post.author.department && (
                      <span className="text-xs text-zinc-500 font-medium block">{post.author.department.name}</span>
                    )}
                    {editingPost?.id === post.id ? (
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          value={editingPost.title}
                          onChange={(e) => setEditingPost((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                          maxLength={120}
                          placeholder="Title *"
                          className="w-full text-sm font-semibold bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:font-normal placeholder:text-zinc-500 transition-all"
                        />
                        <textarea
                          value={editingPost.content}
                          onChange={(e) => { setEditingPost((prev) => (prev ? { ...prev, content: e.target.value } : prev)); autoResize(e.target); }}
                          rows={3}
                          className="w-full resize-none overflow-hidden text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:text-zinc-500 transition-all"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveEditPost(post)}
                            disabled={savingPostEdit || !editingPost.content.trim() || !editingPost.title.trim()}
                            className="flex items-center gap-1.5 bg-[#111827] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Check className="w-3.5 h-3.5" /> Save
                          </button>
                          <button
                            onClick={() => setEditingPost(null)}
                            className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1.5 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {post.title && (
                          <p className="text-base font-bold text-zinc-900 mt-1 leading-snug">{post.title}</p>
                        )}
                        <p className="text-sm text-gray-700 mt-1 leading-relaxed whitespace-pre-wrap">{renderContent(post.content)}</p>
                      </>
                    )}

                  </div>
                </div>

                {post.imageUrls?.length > 0 && (
                  <PostImages
                    urls={post.imageUrls}
                    authorName={post.author.displayName}
                    onOpen={(index) => setLightbox({ images: post.imageUrls, index })}
                  />
                )}

                {post.type === "POLL" && post.pollOptions.length > 0 && (
                  <PollBlock
                    postId={post.id}
                    options={post.pollOptions}
                    myVoteOptionId={post.myVoteOptionId}
                    voting={votingPost === post.id}
                    onVote={handleVote}
                  />
                )}

                {/* Reactions + comments bar */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/5 gap-3 flex-wrap">
                  <ReactionBar
                    postId={post.id}
                    reactions={post.reactions}
                    myReactions={post.myReactions}
                    onReact={toggleReaction}
                  />
                  <button
                    onClick={() => toggleComments(post.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      openComments[post.id]
                        ? "bg-navy-50 border-navy-200 text-navy-700"
                        : "bg-white border-gray-200 text-gray-500 hover:border-navy-300 hover:text-navy-600"
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
                  </button>
                </div>

                {/* Threaded comments */}
                {openComments[post.id] && (
                  <div className="mt-3 pt-3 border-t border-black/5 space-y-4">
                    {commentsLoading[post.id] && (
                      <div className="space-y-3 animate-pulse">
                        {[1, 2].map((i) => (
                          <div key={i} className="flex gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-zinc-100 shrink-0" />
                            <div className="flex-1 space-y-1.5">
                              <div className="h-3 bg-zinc-100 rounded w-1/4" />
                              <div className="h-3 bg-zinc-100 rounded w-3/4" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!commentsLoading[post.id] && (commentsCache[post.id] ?? []).map((c) => (
                      <div key={c.id}>
                        {/* Top-level comment */}
                        <div className="flex gap-2.5">
                          <Avatar name={c.author.displayName} url={c.author.avatarUrl} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="bg-gray-50 rounded-2xl px-3.5 py-2.5">
                              <span className="text-xs font-semibold text-gray-900">{c.author.displayName}</span>
                              <p className="text-sm text-gray-700 mt-0.5 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                            </div>
                            <div className="flex items-center gap-3 mt-1 pl-1">
                              <span className="text-[11px] text-gray-500">{timeAgo(c.createdAt)}</span>
                              <button
                                onClick={() =>
                                  setReplyingTo(
                                    replyingTo?.commentId === c.id
                                      ? null
                                      : { postId: post.id, commentId: c.id, displayName: c.author.displayName }
                                  )
                                }
                                className="text-[11px] font-semibold text-gray-500 hover:text-navy-600 transition-colors"
                              >
                                Reply
                              </button>
                              {(c.authorId === dbUser?.id || dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN") && (
                                <button
                                  onClick={() => deleteComment(post.id, c.id)}
                                  className="text-[11px] font-semibold text-gray-500 hover:text-red-500 transition-colors"
                                >
                                  Delete
                                </button>
                              )}
                              {c.replies.length > 0 && (
                                <button
                                  onClick={() =>
                                    setExpandedReplies((prev) => ({ ...prev, [c.id]: !prev[c.id] }))
                                  }
                                  className="text-[11px] font-semibold text-navy-500 hover:text-navy-700 transition-colors"
                                >
                                  {expandedReplies[c.id]
                                    ? "Hide replies"
                                    : `View ${c.replies.length} ${c.replies.length === 1 ? "reply" : "replies"}`}
                                </button>
                              )}
                            </div>

                            {/* Reply input */}
                            {replyingTo?.commentId === c.id && (
                              <div className="flex gap-2 mt-2">
                                <Avatar name={user?.displayName ?? "?"} url={user?.photoURL ?? null} size="sm" />
                                <div className="flex-1 flex gap-2">
                                  <textarea
                                    autoFocus
                                    rows={1}
                                    placeholder={`Reply to ${c.author.displayName}…`}
                                    value={replyDraft[c.id] ?? ""}
                                    onChange={(e) => { setReplyDraft((prev) => ({ ...prev, [c.id]: e.target.value })); autoResize(e.target); }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") setReplyingTo(null);
                                    }}
                                    className="flex-1 text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 transition-all resize-none overflow-hidden"
                                  />
                                  <button
                                    onClick={() => submitReply(post.id, c.id)}
                                    disabled={replySending[c.id] || !(replyDraft[c.id] ?? "").trim()}
                                    className="flex items-center justify-center w-8 h-8 bg-[#111827] text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 shrink-0"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Replies */}
                            {expandedReplies[c.id] && c.replies.length > 0 && (
                              <div className="mt-2 space-y-2 pl-2 border-l-2 border-gray-100">
                                {c.replies.map((r) => (
                                  <div key={r.id} className="flex gap-2">
                                    <Avatar name={r.author.displayName} url={r.author.avatarUrl} size="sm" />
                                    <div className="flex-1 min-w-0">
                                      <div className="bg-gray-50 rounded-2xl px-3.5 py-2.5">
                                        <span className="text-xs font-semibold text-gray-900">{r.author.displayName}</span>
                                        <p className="text-sm text-gray-700 mt-0.5 leading-relaxed whitespace-pre-wrap">{r.content}</p>
                                      </div>
                                      <div className="flex items-center gap-3 mt-1 pl-1">
                                        <span className="text-[11px] text-gray-500">{timeAgo(r.createdAt)}</span>
                                        {(r.authorId === dbUser?.id || dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN") && (
                                          <button
                                            onClick={() => deleteComment(post.id, r.id, c.id)}
                                            className="text-[11px] font-semibold text-gray-500 hover:text-red-500 transition-colors"
                                          >
                                            Delete
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* New comment input */}
                    <div className="flex gap-2.5 items-center pt-1">
                      <Avatar name={user?.displayName ?? "?"} url={user?.photoURL ?? null} size="sm" />
                      <div className="flex-1 flex gap-2">
                        <textarea
                          rows={1}
                          placeholder="Write a comment…"
                          value={commentDraft[post.id] ?? ""}
                          onChange={(e) => { setCommentDraft((prev) => ({ ...prev, [post.id]: e.target.value })); autoResize(e.target); }}
                          className="flex-1 text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 transition-all resize-none overflow-hidden"
                        />
                        <button
                          onClick={() => submitComment(post.id)}
                          disabled={commentSending[post.id] || !(commentDraft[post.id] ?? "").trim()}
                          className="flex items-center justify-center w-8 h-8 bg-[#111827] text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {!loading && nextCursor && (
        <div className="flex justify-center pt-2">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-600 hover:border-zinc-300 hover:text-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? "Loading…" : "Load more posts"}
          </button>
        </div>
      )}
        </div>
      </div>

      {/* ── Lightbox (shared component, supports prev/next + keyboard) ── */}
      <ImageLightbox
        images={lightbox?.images ?? []}
        initialIndex={lightbox?.index ?? 0}
        open={lightbox !== null}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
