"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Send, ImagePlus, X, ZoomIn, MessageCircle, SmilePlus, Trash2, ChevronLeft, ChevronRight, Pencil, Check } from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { timeAgo } from "@/lib/helpers/timeAgo";

type PollOption = {
  id: string;
  text: string;
  _count: { votes: number };
};

type FeedPost = {
  id: string;
  authorId: string;
  type: string;
  content: string;
  imageUrls: string[];
  createdAt: string;
  author: { displayName: string; avatarUrl: string | null };
  recipient: { id: string; displayName: string; avatarUrl: string | null } | null;
  reactions: Record<string, number>;
  myReactions: string[];
  commentCount: number;
  pollOptions: PollOption[];
  myVoteOptionId: string | null;
};

type ReplyItem = {
  id: string;
  content: string;
  createdAt: string;
  parentId: string | null;
  author: { displayName: string; avatarUrl: string | null };
};

type CommentItem = {
  id: string;
  content: string;
  createdAt: string;
  author: { displayName: string; avatarUrl: string | null };
  replies: ReplyItem[];
};

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
            <span className="text-xs text-gray-400 font-medium ml-0.5">
              {totalReactions} {totalReactions === 1 ? "reaction" : "reactions"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const postTypeMeta: Record<string, { bg: string; chip: string; label: string }> = {
  CELEBRATION:  { bg: "bg-amber-50 border-amber-200",   chip: "bg-amber-100 text-amber-700",   label: "🎉 Celebration" },
  ANNOUNCEMENT: { bg: "bg-navy-50 border-navy-200", chip: "bg-navy-100 text-navy-700", label: "📢 Announcement" },
  ACHIEVEMENT:  { bg: "bg-violet-50 border-violet-200", chip: "bg-violet-100 text-violet-700", label: "🏆 Achievement" },
  UPDATE:       { bg: "bg-white border-zinc-200",        chip: "",                              label: "" },
  POLL:         { bg: "bg-white border-zinc-200",        chip: "bg-navy-100 text-navy-700", label: "📊 Poll" },
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
            <span className="relative flex items-center justify-between">
              <span>{opt.text}{voted && <span className="ml-1.5 text-navy-600 text-xs">✓ Voted</span>}</span>
              <span className="text-xs text-gray-400 font-normal ml-3 shrink-0">{pct}% · {opt._count.votes}</span>
            </span>
          </button>
        );
      })}
      <p className="text-xs text-gray-400 pl-1">{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</p>
    </div>
  );
}

function ImageCarousel({
  urls,
  onOpen,
}: {
  urls: string[];
  onOpen: (url: string) => void;
}) {
  const [index, setIndex] = useState(0);
  if (urls.length === 0) return null;

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i - 1 + urls.length) % urls.length);
  };
  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i + 1) % urls.length);
  };

  return (
    <div className="mt-3 relative group/carousel rounded-xl overflow-hidden bg-black select-none">
      {/* Image */}
      <button
        type="button"
        onClick={() => onOpen(urls[index])}
        className="block w-full focus:outline-none"
        aria-label="View full image"
      >
        <img
          key={urls[index]}
          src={urls[index]}
          alt={`Image ${index + 1} of ${urls.length}`}
          className="w-full max-h-[480px] object-cover transition-opacity duration-200"
          draggable={false}
        />
        {/* Zoom hint */}
        <div className="absolute inset-0 bg-black/0 group-hover/carousel:bg-black/15 transition-colors duration-200 flex items-center justify-center pointer-events-none">
          <div className="opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-200 bg-black/50 backdrop-blur-sm rounded-full p-2">
            <ZoomIn className="w-4 h-4 text-white" />
          </div>
        </div>
      </button>

      {/* Prev / Next — only when multiple images */}
      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-150 hover:bg-black/70 z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-150 hover:bg-black/70 z-10"
            aria-label="Next image"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {urls.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                className={`rounded-full transition-all duration-200 ${
                  i === index
                    ? "w-4 h-1.5 bg-white"
                    : "w-1.5 h-1.5 bg-white/50 hover:bg-white/80"
                }`}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>

          {/* Counter badge */}
          <div className="absolute top-2.5 right-2.5 bg-black/50 text-white text-xs font-semibold px-2 py-0.5 rounded-full z-10">
            {index + 1} / {urls.length}
          </div>
        </>
      )}
    </div>
  );
}

function Avatar({ name, url, size = "sm" }: { name: string; url: string | null; size?: "sm" | "md" }) {
  const dim = size === "md" ? "w-10 h-10 text-base" : "w-8 h-8 text-sm";
  if (url) return <img src={url} alt={name} className={`${dim} rounded-full object-cover shrink-0`} />;
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-navy-400 to-violet-500 flex items-center justify-center text-white font-bold shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function FeedPage() {
  const { user, dbUser, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<{ id: string; content: string; postId: string; isReply: boolean; parentId?: string } | null>(null);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [pollMode, setPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [votingPost, setVotingPost] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentsCache, setCommentsCache] = useState<Record<string, CommentItem[]>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [commentSending, setCommentSending] = useState<Record<string, boolean>>({});
  const [replyingTo, setReplyingTo] = useState<{ postId: string; commentId: string; displayName: string } | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replySending, setReplySending] = useState<Record<string, boolean>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showShoutoutForm, setShowShoutoutForm] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; displayName: string; avatarUrl: string | null }[]>([]);
  const [shoutoutRecipientId, setShoutoutRecipientId] = useState("");
  const [shoutoutContent, setShoutoutContent] = useState("");
  const [shoutoutSubmitting, setShoutoutSubmitting] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxUrl(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    load(activeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, activeFilter]);

  useEffect(() => {
    if (!showShoutoutForm || employees.length > 0) return;
    apiFetch<{ data: { id: string; displayName: string; avatarUrl: string | null }[] }>("/api/employees")
      .then((res) => setEmployees(res.data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showShoutoutForm]);

  async function load(filter = "ALL") {
    setLoading(true);
    setLoadError(null);
    setNextCursor(null);
    try {
      const url = filter === "ALL" ? "/api/feed" : `/api/feed?type=${filter}`;
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
      const base = activeFilter === "ALL" ? "/api/feed" : `/api/feed?type=${activeFilter}`;
      const res = await apiFetch<{ data: FeedPost[]; nextCursor: string | null }>(`${base}${activeFilter === "ALL" ? "?" : "&"}cursor=${nextCursor}`);
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
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function clearImages() {
    setImageFiles([]);
    setImagePreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!newPost.trim()) return;
    setPosting(true);
    try {
      let imageUrls: string[] = [];
      if (imageFiles.length > 0) {
        setUploading(true);
        imageUrls = await Promise.all(imageFiles.map((f) => uploadToCloudinary(f)));
        setUploading(false);
      }

      if (pollMode) {
        const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
        if (opts.length < 2) return;
        await apiFetch("/api/feed", {
          method: "POST",
          body: JSON.stringify({ content: newPost.trim(), type: "POLL", options: opts, imageUrls }),
        });
        setPollMode(false);
        setPollOptions(["", ""]);
      } else {
        await apiFetch("/api/feed", {
          method: "POST",
          body: JSON.stringify({ content: newPost.trim(), type: "UPDATE", imageUrls }),
        });
      }
      setNewPost("");
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
      const res = await apiFetch<{ data: CommentItem[] }>(`/api/feed/${postId}/comments`);
      setCommentsCache((prev) => ({ ...prev, [postId]: res.data }));
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
    await apiFetch(`/api/feed/${postId}/comments/${commentId}`, { method: "DELETE" });
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

  async function deletePost(postId: string) {
    if (!confirm("Delete this post?")) return;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await apiFetch(`/api/feed/${postId}`, { method: "DELETE" });
    } catch {
      await load();
    }
  }

  async function handleShoutoutSubmit() {
    if (!shoutoutRecipientId || !shoutoutContent.trim()) return;
    setShoutoutSubmitting(true);
    try {
      const res = await apiFetch<{ data: FeedPost }>("/api/feed", {
        method: "POST",
        body: JSON.stringify({ type: "SHOUTOUT", content: shoutoutContent.trim(), recipientId: shoutoutRecipientId }),
      });
      setPosts((prev) => [res.data, ...prev]);
      setShoutoutContent("");
      setShoutoutRecipientId("");
      setShowShoutoutForm(false);
    } catch {
      // silent — user sees no change
    } finally {
      setShoutoutSubmitting(false);
    }
  }

  async function toggleReaction(postId: string, emoji: string) {
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

    await apiFetch(`/api/feed/${postId}/react`, { method: "POST", body: JSON.stringify({ emoji }) });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Activity Feed</h1>
        <p className="text-zinc-500 text-sm mt-1">What&apos;s happening across the company</p>
      </div>

      {/* Compose */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4">
        <form onSubmit={handlePost} className="space-y-3">
          <div className="flex gap-3">
            <Avatar name={user?.displayName ?? "?"} url={user?.photoURL ?? null} size="md" />
            <textarea
              placeholder="Share something with the team…"
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              rows={2}
              className="flex-1 resize-none text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:text-zinc-400 transition-all"
            />
          </div>

          {/* Image previews */}
          {imagePreviews.length > 0 && (
            <div className={`grid gap-2 ${imagePreviews.length === 1 ? "grid-cols-1" : imagePreviews.length === 2 ? "grid-cols-2" : "grid-cols-2"}`}>
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative group">
                  <img src={src} alt={`Preview ${i + 1}`} className="w-full h-32 rounded-xl object-cover border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-gray-900/70 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
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
                setPollMode((v) => !v);
                if (pollMode) setPollOptions(["", ""]);
              }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                pollMode
                  ? "bg-navy-600 border-navy-600 text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-navy-300 hover:text-navy-600"
              }`}
            >
              📊 Add Poll
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
                    className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-400 transition-all"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500 text-sm transition-colors"
                      aria-label="Remove option"
                    >
                      ✕
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

          {(newPost.trim() || imageFiles.length > 0) && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={posting || (pollMode && pollOptions.filter((o) => o.trim()).length < 2)}
                className="flex items-center gap-2 bg-navy-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-navy-700 transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {uploading ? "Uploading…" : posting ? "Posting…" : "Post"}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 w-fit">
        {(["All", "Updates", "Shoutouts"] as const).map((label) => {
          const value = label === "All" ? "ALL" : label === "Updates" ? "UPDATE" : "SHOUTOUT";
          return (
            <button
              key={label}
              onClick={() => { setActiveFilter(value); setPosts([]); setNextCursor(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === value
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Give Shoutout */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-700">Recognize a colleague</span>
          <button
            onClick={() => setShowShoutoutForm((v) => !v)}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            ✨ Give Shoutout
          </button>
        </div>

        {showShoutoutForm && (
          <div className="px-5 pb-4 border-t border-zinc-100 pt-3 space-y-3">
            <select
              value={shoutoutRecipientId}
              onChange={(e) => setShoutoutRecipientId(e.target.value)}
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition bg-white"
            >
              <option value="">Select a colleague…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.displayName}</option>
              ))}
            </select>
            <textarea
              value={shoutoutContent}
              onChange={(e) => setShoutoutContent(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="What did they do that deserves recognition?"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">{shoutoutContent.length}/500</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowShoutoutForm(false); setShoutoutContent(""); setShoutoutRecipientId(""); }}
                  className="text-sm text-zinc-500 hover:text-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleShoutoutSubmit}
                  disabled={shoutoutSubmitting || !shoutoutRecipientId || !shoutoutContent.trim()}
                  className="text-sm bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {shoutoutSubmitting ? "Sending…" : "Send Shoutout"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Posts */}
      {loadError ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
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
          <div className="text-5xl mb-4">📣</div>
          <p className="text-gray-600 font-medium">No posts yet</p>
          <p className="text-gray-400 text-sm mt-1">Award points to an employee to generate the first post!</p>
        </div>
      ) : (
        posts.map((post) => {
          if (post.type === "SHOUTOUT" && post.recipient) {
            return (
              <div key={post.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-amber-400 to-yellow-300" />
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Avatar name={post.author.displayName} url={post.author.avatarUrl} size="sm" />
                      <span className="text-sm font-semibold text-zinc-800">{post.author.displayName}</span>
                    </div>
                    <span className="text-sm text-amber-600 font-medium">✨ gave a shoutout to</span>
                    <div className="flex items-center gap-1.5">
                      <Avatar name={post.recipient.displayName} url={post.recipient.avatarUrl} size="sm" />
                      <span className="text-sm font-semibold text-zinc-800">{post.recipient.displayName}</span>
                    </div>
                    <span className="text-xs text-zinc-400 ml-auto">{timeAgo(post.createdAt)}</span>
                    {(post.authorId === dbUser?.id || dbUser?.role === "HR_ADMIN") && (
                      <button
                        onClick={() => deletePost(post.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-50"
                        title="Delete post"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-zinc-700 leading-relaxed">{post.content}</p>
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
                      {(commentsCache[post.id] ?? []).map((c) => (
                        <div key={c.id}>
                          <div className="flex gap-2.5">
                            <Avatar name={c.author.displayName} url={c.author.avatarUrl} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="bg-gray-50 rounded-2xl px-3.5 py-2.5">
                                <span className="text-xs font-semibold text-gray-900">{c.author.displayName}</span>
                                <p className="text-sm text-gray-700 mt-0.5 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                              </div>
                              <div className="flex items-center gap-3 mt-1 pl-1">
                                <span className="text-[11px] text-gray-400">{timeAgo(c.createdAt)}</span>
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
                                    <input
                                      autoFocus
                                      type="text"
                                      placeholder={`Reply to ${c.author.displayName}…`}
                                      value={replyDraft[c.id] ?? ""}
                                      onChange={(e) => setReplyDraft((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitReply(post.id, c.id); }
                                        if (e.key === "Escape") setReplyingTo(null);
                                      }}
                                      className="flex-1 text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-400 transition-all"
                                    />
                                    <button
                                      onClick={() => submitReply(post.id, c.id)}
                                      disabled={replySending[c.id] || !(replyDraft[c.id] ?? "").trim()}
                                      className="flex items-center justify-center w-8 h-8 bg-navy-600 text-white rounded-xl hover:bg-navy-700 transition-colors disabled:opacity-50 shrink-0"
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
                                        <span className="text-[11px] text-gray-400 mt-1 pl-1 block">{timeAgo(r.createdAt)}</span>
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
                          <input
                            type="text"
                            placeholder="Write a comment…"
                            value={commentDraft[post.id] ?? ""}
                            onChange={(e) => setCommentDraft((prev) => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(post.id); }
                            }}
                            className="flex-1 text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-400 transition-all"
                          />
                          <button
                            onClick={() => submitComment(post.id)}
                            disabled={commentSending[post.id] || !(commentDraft[post.id] ?? "").trim()}
                            className="flex items-center justify-center w-8 h-8 bg-navy-600 text-white rounded-xl hover:bg-navy-700 transition-colors disabled:opacity-50 shrink-0"
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
            <div key={post.id} className={`rounded-xl border overflow-hidden ${meta.bg}`}>
              <div className="p-5">
                {/* Post type chip */}
                {meta.label && (
                  <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-3 ${meta.chip}`}>
                    {meta.label}
                  </span>
                )}

                {/* Author row */}
                <div className="flex gap-3">
                  <Avatar name={post.author.displayName} url={post.author.avatarUrl} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm text-gray-900">{post.author.displayName}</span>
                      <span className="text-xs text-gray-400">{timeAgo(post.createdAt)}</span>
                      {(post.authorId === dbUser?.id || dbUser?.role === "HR_ADMIN") && (
                        <button
                          onClick={() => deletePost(post.id)}
                          className="ml-auto text-gray-300 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-50"
                          title="Delete post"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-1.5 leading-relaxed whitespace-pre-wrap">{post.content}</p>

                    {post.imageUrls?.length > 0 && (
                      <ImageCarousel urls={post.imageUrls} onOpen={setLightboxUrl} />
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
                  </div>
                </div>

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
                    {(commentsCache[post.id] ?? []).map((c) => (
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
                              <span className="text-[11px] text-gray-400">{timeAgo(c.createdAt)}</span>
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
                                  <input
                                    autoFocus
                                    type="text"
                                    placeholder={`Reply to ${c.author.displayName}…`}
                                    value={replyDraft[c.id] ?? ""}
                                    onChange={(e) => setReplyDraft((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitReply(post.id, c.id); }
                                      if (e.key === "Escape") setReplyingTo(null);
                                    }}
                                    className="flex-1 text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-400 transition-all"
                                  />
                                  <button
                                    onClick={() => submitReply(post.id, c.id)}
                                    disabled={replySending[c.id] || !(replyDraft[c.id] ?? "").trim()}
                                    className="flex items-center justify-center w-8 h-8 bg-navy-600 text-white rounded-xl hover:bg-navy-700 transition-colors disabled:opacity-50 shrink-0"
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
                                      <span className="text-[11px] text-gray-400 mt-1 pl-1 block">{timeAgo(r.createdAt)}</span>
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
                        <input
                          type="text"
                          placeholder="Write a comment…"
                          value={commentDraft[post.id] ?? ""}
                          onChange={(e) => setCommentDraft((prev) => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(post.id); }
                          }}
                          className="flex-1 text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-400 transition-all"
                        />
                        <button
                          onClick={() => submitComment(post.id)}
                          disabled={commentSending[post.id] || !(commentDraft[post.id] ?? "").trim()}
                          className="flex items-center justify-center w-8 h-8 bg-navy-600 text-white rounded-xl hover:bg-navy-700 transition-colors disabled:opacity-50 shrink-0"
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

      {/* ── Lightbox ── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full size"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
