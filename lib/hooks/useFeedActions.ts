"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { seedGifCache, type GifResult } from "@/lib/giphy/client";
import type {
  FeedPost,
  ReplyItem,
  CommentItem,
  UserProfile,
  LeaderboardEntry,
  BirthdayPerson,
  PollOption,
} from "@/lib/types/feed";
import { realtimeTopics } from "@/lib/realtime/topics";

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

export function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

export function useFeedActions() {
  const { user, token, dbUser, loading: authLoading } = useAuth();
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
  const [pollAnonymous, setPollAnonymous] = useState(false);
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
  const [commentsCursor, setCommentsCursor] = useState<Record<string, string | null>>({});
  const [commentsLoadingMore, setCommentsLoadingMore] = useState<Record<string, boolean>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [commentSending, setCommentSending] = useState<Record<string, boolean>>({});
  const [replyingTo, setReplyingTo] = useState<{ postId: string; commentId: string; displayName: string } | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replySending, setReplySending] = useState<Record<string, boolean>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [selectedFlair, setSelectedFlair] = useState<string | null>(null);
  const [showAllFlairs, setShowAllFlairs] = useState(false);
  const [composeExpanded, setComposeExpanded] = useState(false);
  const [deptOnly, setDeptOnly] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionMap, setMentionMap] = useState<Record<string, string>>({});
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<{ postId: string; images: string[]; index: number } | null>(null);
  const [postToast, setPostToast] = useState<string | null>(null);
  const [commentDeleteTarget, setCommentDeleteTarget] = useState<{ postId: string; commentId: string; parentId?: string } | null>(null);
  const [postDeleteTarget, setPostDeleteTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editMentionMapRef = useRef<Record<string, string>>({});
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const recipientSearchRef = useRef<HTMLDivElement>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const [employees, setEmployees] = useState<{ id: string; displayName: string; avatarUrl: string | null }[]>([]);
  const profile: UserProfile | null = dbUser
    ? {
        pointsBalance: dbUser.pointsBalance,
        level: dbUser.level,
        displayName: dbUser.displayName,
        department: dbUser.department,
      }
    : null;
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayPerson[]>([]);
  const [widgetsLoading, setWidgetsLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    load(activeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, activeFilter]);

  // Deep link from a notification (e.g. "?post=<id>" from a mention/comment/
  // reaction notification — see feedPost() in lib/constants/notificationTypes.ts).
  // The target post may not be on the reader's currently loaded page — a
  // different filter, or simply further back than the first page — so it's
  // fetched directly and prepended rather than assumed to already be in `posts`.
  const jumpHandledRef = useRef(false);
  useEffect(() => {
    if (authLoading || !user || loading || jumpHandledRef.current) return;
    const targetPostId = new URLSearchParams(window.location.search).get("post");
    if (!targetPostId) return;
    jumpHandledRef.current = true;

    (async () => {
      if (!posts.some((p) => p.id === targetPostId)) {
        try {
          const res = await apiFetch<{ data: FeedPost }>(`/api/feed/${targetPostId}`);
          setPosts((prev) => (prev.some((p) => p.id === res.data.id) ? prev : [res.data, ...prev]));
        } catch (err) {
          console.error("failed to load linked post", err);
          return;
        }
      }
      setOpenComments((prev) => ({ ...prev, [targetPostId]: true }));
      if (!commentsCache[targetPostId]) await refreshComments(targetPostId);
      jumpToPost(targetPostId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, loading]);

  // Keep open discussions live without resetting the reader's scroll/pagination.
  // New/edited feed items still use the existing banner so content does not
  // jump underneath someone who is reading or composing.
  useRealtimeChannel(realtimeTopics.feed, () => {
    setHasNewPosts(true);
    Object.entries(openComments)
      .filter(([, isOpen]) => isOpen)
      .forEach(([postId]) => refreshComments(postId, false));
  }, { debounceMs: 200 });

  useRealtimeChannel(realtimeTopics.employees, () => {
    apiFetch<{ data: BirthdayPerson[] }>("/api/birthdays/upcoming")
      .then((res) => setBirthdays((res.data ?? []).filter((birthday) => birthday.daysUntil <= 7)))
      .catch((err) => console.error("birthdays refresh failed", err));
    if (composeExpanded) {
      apiFetch<{ data: { id: string; displayName: string; avatarUrl: string | null }[] }>("/api/employees")
        .then((res) => setEmployees(res.data))
        .catch((err) => console.error("employees refresh failed", err));
    }
  }, { debounceMs: 250 });

  // Loads the roster once, on demand. Called when the post composer expands and
  // when someone first types "@" in a comment or reply — a comment-only user
  // used to get an empty mention dropdown because this was gated purely on the
  // post composer. Guarded so it stays a single /api/employees call per session
  // rather than one per page load.
  const employeesLoading = useRef(false);
  const ensureEmployeesLoaded = useCallback(() => {
    if (authLoading || !user || employees.length > 0 || employeesLoading.current) return;
    employeesLoading.current = true;
    apiFetch<{ data: { id: string; displayName: string; avatarUrl: string | null }[] }>("/api/employees")
      .then((res) => setEmployees(res.data))
      .catch((err) => {
        employeesLoading.current = false;
        console.error("employees fetch failed", err);
      });
    // apiFetch is a stable module-level import; listed only to satisfy the
    // exhaustive-deps rule without an eslint-disable.
  }, [authLoading, user, employees.length, apiFetch]);

  useEffect(() => {
    if (!composeExpanded) return;
    ensureEmployeesLoaded();
  }, [composeExpanded, ensureEmployeesLoaded]);

  useEffect(() => {
    if (authLoading || !user) return;
    Promise.allSettled([
      apiFetch<{ data: LeaderboardEntry[] }>("/api/leaderboard"),
      apiFetch<{ data: BirthdayPerson[] }>("/api/birthdays/upcoming"),
    ]).then(([lb, bd]) => {
      if (lb.status === "fulfilled") setLeaderboard(lb.value.data ?? []);
      if (bd.status === "fulfilled") setBirthdays((bd.value.data ?? []).filter((b) => b.daysUntil <= 7));
    }).finally(() => setWidgetsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useRealtimeChannel(realtimeTopics.leaderboard, () => {
    apiFetch<{ data: LeaderboardEntry[] }>("/api/leaderboard")
      .then((res) => setLeaderboard(res.data ?? []))
      .catch((err) => console.error("feed leaderboard refresh failed", err));
  }, { debounceMs: 250 });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (recipientSearchRef.current && !recipientSearchRef.current.contains(e.target as Node)) {
        setRecipientSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (composeExpanded && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [composeExpanded]);

  async function load(filter = "ALL") {
    // Cancel whatever filter switch is still in flight so an out-of-order
    // response (e.g. a slow "All" request resolving after a faster
    // "Shoutouts" one) can't overwrite state for a filter that's no longer
    // selected.
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    setLoading(true);
    setLoadError(null);
    setNextCursor(null);
    try {
      const url = filter === "ALL" ? "/api/feed" : filter === "DEPT_ONLY" ? "/api/feed?dept=mine" : `/api/feed?type=${filter}`;
      const res = await apiFetch<{ data: FeedPost[]; nextCursor: string | null }>(url, { signal: controller.signal });
      setPosts(res.data);
      setNextCursor(res.nextCursor);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setLoadError(err instanceof Error ? err.message : "Failed to load feed");
    } finally {
      if (loadAbortRef.current === controller) setLoading(false);
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

    // Validate every branch's requirements BEFORE uploading anything —
    // an early return after the Cloudinary upload orphaned the just-uploaded
    // images (nothing ever referenced them) and, since imageFiles was never
    // cleared on that path, silently re-uploaded the same files again on retry.
    if (shoutoutMode) {
      if (recipients.length === 0 || !newPost.trim()) return;
    } else if (pollMode) {
      if (!postTitle.trim() || !newPost.trim() || !selectedFlair) return;
      if (pollOptions.map((o) => o.trim()).filter(Boolean).length < 2) return;
    } else {
      if (!postTitle.trim() || !newPost.trim() || !selectedFlair) return;
    }

    setPosting(true);
    try {
      let imageUrls: string[] = [];
      if (imageFiles.length > 0) {
        setUploading(true);
        imageUrls = await Promise.all(imageFiles.map((f) => uploadToCloudinary(f, token!)));
        setUploading(false);
      }

      if (shoutoutMode) {
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
        const content = buildContent(newPost.trim());
        const title = postTitle.trim();
        if (pollMode) {
          const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
          await apiFetch("/api/feed", {
            method: "POST",
            body: JSON.stringify({ title, content, type: "POLL", flair: selectedFlair, options: opts, imageUrls, deptOnly, isAnonymous: pollAnonymous }),
          });
          setPollMode(false); setPollOptions(["", ""]); setPollAnonymous(false);
        } else {
          // Only these three flairs double as a feed post `type` (matching the
          // sidebar's category filters) — every other flair is decorative only
          // and the post stays type UPDATE, same as it filters under "All".
          const type = ["ANNOUNCEMENT", "ACHIEVEMENT", "CELEBRATION"].includes(selectedFlair ?? "")
            ? selectedFlair
            : "UPDATE";
          await apiFetch("/api/feed", {
            method: "POST",
            body: JSON.stringify({ title, content, type, flair: selectedFlair, imageUrls, deptOnly }),
          });
        }
        setPostTitle(""); setSelectedFlair(null); setDeptOnly(false); setMentionMap({}); setShowAllFlairs(false); setComposeExpanded(false);
      }

      setNewPost("");
      if (composerRef.current) composerRef.current.style.height = "auto";
      clearImages();
      await load();
    } catch {
      setPostToast("Something went wrong. Please try again.");
      setTimeout(() => setPostToast(null), 4000);
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

  async function refreshComments(postId: string, showLoading = true) {
    if (showLoading) setCommentsLoading((prev) => ({ ...prev, [postId]: true }));
    try {
      const res = await apiFetch<{ data: CommentItem[]; nextCursor: string | null }>(`/api/feed/${postId}/comments`);
      setCommentsCache((prev) => {
        if (showLoading || !prev[postId]) return { ...prev, [postId]: res.data };
        // Silent background refresh (realtime sync) of an already-open thread:
        // upsert the latest page's rows without discarding older pages
        // already pulled in via "View earlier comments".
        const existing = prev[postId];
        const byId = new Map(existing.map((c) => [c.id, c]));
        for (const c of res.data) byId.set(c.id, c);
        const merged = existing.map((c) => byId.get(c.id)!);
        for (const c of res.data) if (!existing.some((e) => e.id === c.id)) merged.push(c);
        return { ...prev, [postId]: merged };
      });
      // Only a fresh open resets the cursor — a silent background refresh only
      // ever re-fetches the latest page, so it must not clobber a cursor that
      // "View earlier comments" has already paged further back than that.
      if (showLoading) setCommentsCursor((prev) => ({ ...prev, [postId]: res.nextCursor }));
    } catch (err) {
      // Leave the cache empty on failure rather than throwing — an uncaught
      // rejection here previously let a transient backend error retry forever
      // (every re-render re-triggered the "ensure loaded" effect since the
      // cache never got populated), which crashed the page with a React
      // "Maximum update depth exceeded" error.
      console.error("comments refresh failed", err);
    } finally {
      if (showLoading) setCommentsLoading((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function loadMoreComments(postId: string) {
    const cursor = commentsCursor[postId];
    if (!cursor || commentsLoadingMore[postId]) return;
    setCommentsLoadingMore((prev) => ({ ...prev, [postId]: true }));
    try {
      const res = await apiFetch<{ data: CommentItem[]; nextCursor: string | null }>(
        `/api/feed/${postId}/comments?cursor=${encodeURIComponent(cursor)}`
      );
      // Older page is prepended: the API returns comments oldest-first within
      // the post, and "earlier" means further up the thread.
      setCommentsCache((prev) => ({ ...prev, [postId]: [...res.data, ...(prev[postId] ?? [])] }));
      setCommentsCursor((prev) => ({ ...prev, [postId]: res.nextCursor }));
    } catch (err) {
      console.error("load more comments failed", err);
    } finally {
      setCommentsLoadingMore((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function toggleComments(postId: string) {
    const next = !openComments[postId];
    setOpenComments((prev) => ({ ...prev, [postId]: next }));
    if (next && !commentsCache[postId]) {
      await refreshComments(postId);
    }
  }

  async function submitComment(postId: string, gif?: GifResult, encodedContent?: string) {
    // encodedContent carries @[Name|id] tokens resolved by the composer's
    // mention picker; fall back to the raw draft when there are no mentions.
    const content = (encodedContent ?? commentDraft[postId] ?? "").trim();
    if (!content && !gif) return;
    setCommentSending((prev) => ({ ...prev, [postId]: true }));
    const optimisticId = `opt-${Date.now()}`;
    const optimistic: CommentItem = {
      id: optimisticId,
      content: content || null,
      commentType: gif ? "GIF" : "TEXT",
      gifProvider: gif?.provider ?? null,
      gifId: gif?.id ?? null,
      createdAt: new Date().toISOString(),
      authorId: user?.uid ?? "",
      author: { displayName: user?.displayName ?? "You", avatarUrl: user?.photoURL ?? null },
      replies: [],
      reactions: {},
      myReactions: [],
    };
    if (gif) seedGifCache(gif);
    setCommentsCache((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), optimistic] }));
    setCommentDraft((prev) => ({ ...prev, [postId]: "" }));
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)));
    try {
      const res = await apiFetch<{ data: CommentItem }>(`/api/feed/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({
          content: content || undefined,
          commentType: gif ? "GIF" : "TEXT",
          gifProvider: gif?.provider,
          gifId: gif?.id,
        }),
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

  async function submitReply(postId: string, parentId: string, gif?: GifResult, encodedContent?: string) {
    const content = (encodedContent ?? replyDraft[parentId] ?? "").trim();
    if (!content && !gif) return;
    setReplySending((prev) => ({ ...prev, [parentId]: true }));
    const optimisticId = `opt-reply-${Date.now()}`;
    const optimistic: ReplyItem = {
      id: optimisticId,
      content: content || null,
      commentType: gif ? "GIF" : "TEXT",
      gifProvider: gif?.provider ?? null,
      gifId: gif?.id ?? null,
      createdAt: new Date().toISOString(),
      parentId,
      authorId: user?.uid ?? "",
      author: { displayName: user?.displayName ?? "You", avatarUrl: user?.photoURL ?? null },
      reactions: {},
      myReactions: [],
    };
    if (gif) seedGifCache(gif);
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
        body: JSON.stringify({
          content: content || undefined,
          parentId,
          commentType: gif ? "GIF" : "TEXT",
          gifProvider: gif?.provider,
          gifId: gif?.id,
        }),
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

  function deleteComment(postId: string, commentId: string, parentId?: string) {
    setCommentDeleteTarget({ postId, commentId, parentId });
  }

  async function confirmDeleteComment() {
    if (!commentDeleteTarget) return;
    const { postId, commentId, parentId } = commentDeleteTarget;
    setCommentDeleteTarget(null);
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
      await load(activeFilter);
    } finally {
      setSavingPostEdit(false);
    }
  }

  function deletePost(postId: string) {
    setPostDeleteTarget(postId);
  }

  async function confirmDeletePost() {
    if (!postDeleteTarget) return;
    const postId = postDeleteTarget;
    setPostDeleteTarget(null);
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update pin");
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, isPinned: !newPinned } : p));
    }
  }

  // `attempts` covers the deep-link case below, where the target post is
  // fetched and prepended to `posts` asynchronously — the DOM node isn't
  // there yet on the first call, so this polls briefly instead of giving up.
  function jumpToPost(id: string, attempts = 20) {
    const el = document.getElementById(`feed-post-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-amber-300");
      setTimeout(() => el.classList.remove("ring-2", "ring-amber-300"), 1600);
      return;
    }
    if (attempts > 0) setTimeout(() => jumpToPost(id, attempts - 1), 100);
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

  async function toggleCommentReaction(postId: string, commentId: string, emoji: string, parentId?: string) {
    const previousCache = commentsCache;
    // Optimistic update — mirrors toggleReaction's post-level logic above,
    // applied to whichever comment or reply carries this id inside the
    // nested per-post cache. `parentId` disambiguates a reply from a
    // top-level comment sharing the lookup, same as onDeleteComment already
    // does elsewhere in this file.
    function patch<T extends { reactions: Record<string, number>; myReactions: string[] }>(item: T): T {
      const current = item.myReactions[0] ?? null;
      const newReactions = { ...item.reactions };
      if (current) {
        newReactions[current] = (newReactions[current] ?? 1) - 1;
        if (newReactions[current] <= 0) delete newReactions[current];
      }
      if (current === emoji) {
        return { ...item, reactions: newReactions, myReactions: [] };
      }
      newReactions[emoji] = (newReactions[emoji] ?? 0) + 1;
      return { ...item, reactions: newReactions, myReactions: [emoji] };
    }

    setCommentsCache((prev) => {
      const comments = prev[postId] ?? [];
      const updated = comments.map((c) => {
        if (!parentId && c.id === commentId) return patch(c);
        if (parentId && c.id === parentId) {
          return { ...c, replies: c.replies.map((r) => (r.id === commentId ? patch(r) : r)) };
        }
        return c;
      });
      return { ...prev, [postId]: updated };
    });

    try {
      await apiFetch(`/api/feed/${postId}/comments/${commentId}/react`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
    } catch {
      setCommentsCache(previousCache);
    }
  }

  return {
    // state
    posts, setPosts,
    loading,
    hasNewPosts, setHasNewPosts,
    loadingMore,
    nextCursor, setNextCursor,
    activeFilter, setActiveFilter,
    loadError,
    editingPost, setEditingPost,
    savingPostEdit,
    postTitle, setPostTitle,
    newPost, setNewPost,
    posting,
    pollMode, setPollMode,
    pollOptions, setPollOptions,
    pollAnonymous, setPollAnonymous,
    shoutoutMode, setShoutoutMode,
    shoutoutTitle, setShoutoutTitle,
    shoutoutDeptOnly, setShoutoutDeptOnly,
    recipients, setRecipients,
    recipientSearch, setRecipientSearch,
    recipientSearchOpen, setRecipientSearchOpen,
    votingPost,
    openComments,
    commentsCache,
    commentsLoading,
    commentsCursor,
    commentsLoadingMore,
    commentDraft, setCommentDraft,
    commentSending,
    replyingTo, setReplyingTo,
    replyDraft, setReplyDraft,
    replySending,
    expandedReplies, setExpandedReplies,
    selectedFlair, setSelectedFlair,
    showAllFlairs, setShowAllFlairs,
    composeExpanded, setComposeExpanded,
    deptOnly, setDeptOnly,
    mentionQuery,
    mentionResults,
    imageFiles,
    imagePreviews,
    uploading,
    lightbox, setLightbox,
    postToast,
    commentDeleteTarget, setCommentDeleteTarget,
    postDeleteTarget, setPostDeleteTarget,
    employees,
    ensureEmployeesLoaded,
    profile,
    leaderboard,
    birthdays,
    widgetsLoading,

    // refs
    fileInputRef,
    composerRef,
    titleInputRef,
    mentionDropdownRef,
    recipientSearchRef,

    // handlers
    load,
    loadMore,
    handleImageSelect,
    removeImage,
    clearImages,
    handlePost,
    handleVote,
    toggleComments,
    refreshComments,
    loadMoreComments,
    submitComment,
    submitReply,
    deleteComment,
    confirmDeleteComment,
    saveEditComment,
    startEditPost,
    saveEditPost,
    deletePost,
    confirmDeletePost,
    togglePin,
    jumpToPost,
    autoResize,
    handleComposerChange,
    insertMention,
    toggleReaction,
    toggleCommentReaction,
  };
}
