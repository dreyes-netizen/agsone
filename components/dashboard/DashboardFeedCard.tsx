"use client";

import React, { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Send, SmilePlus } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { timeAgo, postTimestamp } from "@/lib/helpers/timeAgo";

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

export type DashboardFeedPost = {
  id: string;
  type: string;
  content: string;
  createdAt: string;
  author: { id: string; displayName: string; avatarUrl: string | null };
  recipient: { id: string; displayName: string; avatarUrl: string | null } | null;
  reactions: Record<string, number>;
  myReactions: string[];
  commentCount: number;
  imageUrls: string[];
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

function Avatar({
  url,
  name,
  size = "w-8 h-8",
}: {
  url: string | null;
  name: string;
  size?: string;
}) {
  return url ? (
    <img src={url} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
  ) : (
    <div
      className={`${size} rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600 font-bold text-xs shrink-0`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

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
  function handleMainClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (myReaction) {
      onReact(postId, myReaction);
    } else {
      setPickerOpen((v) => !v);
    }
  }

  return (
    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
      <div className="relative" onMouseEnter={openPicker} onMouseLeave={closePicker}>
        {pickerOpen && (
          <div className="absolute bottom-full left-0 z-20 pb-2">
            <div className="flex items-center gap-1 bg-white rounded-full shadow-xl border border-gray-100 px-3 py-2.5">
              {EMOJIS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  type="button"
                  title={label}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReact(postId, emoji);
                    closePicker();
                  }}
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
          <span>
            {myReaction
              ? EMOJIS.find((e) => e.emoji === myReaction)?.label ?? "Reacted"
              : "React"}
          </span>
        </button>
      </div>

      {totalReactions > 0 && (
        <div className="flex items-center gap-1.5">
          {Object.entries(reactions)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([emoji, count]) => (
              <span
                key={emoji}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                  EMOJI_BG[emoji] ?? "bg-gray-50 text-gray-600 border-gray-200"
                }`}
              >
                {emoji} {count}
              </span>
            ))}
          <span className="text-xs text-gray-400 font-medium ml-0.5">
            {totalReactions} {totalReactions === 1 ? "reaction" : "reactions"}
          </span>
        </div>
      )}
    </div>
  );
}

export function DashboardFeedCard({ post: initialPost }: { post: DashboardFeedPost }) {
  const router = useRouter();
  const { user, dbUser } = useAuth();
  const { apiFetch } = useApiClient();

  // ── Reaction state ──────────────────────────────────────────────────────────
  const [reactions, setReactions] = useState(initialPost.reactions);
  const [myReactions, setMyReactions] = useState(initialPost.myReactions);

  // ── Comment state ───────────────────────────────────────────────────────────
  const [commentCount, setCommentCount] = useState(initialPost.commentCount);
  const [openComments, setOpenComments] = useState(false);
  const [commentsData, setCommentsData] = useState<CommentItem[]>([]);
  const [commentsFetched, setCommentsFetched] = useState(false);
  const [commentsFetchError, setCommentsFetchError] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; displayName: string } | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replySending, setReplySending] = useState<Record<string, boolean>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

  // ── Handlers ────────────────────────────────────────────────────────────────

  const toggleReaction = useCallback(async (postId: string, emoji: string) => {
    const prevReactions = { ...reactions };
    const prevMyReactions = [...myReactions];
    const current = myReactions[0] ?? null;
    const next = { ...reactions };
    if (current) {
      next[current] = (next[current] ?? 1) - 1;
      if (next[current] <= 0) delete next[current];
    }
    if (current === emoji) {
      setReactions(next);
      setMyReactions([]);
    } else {
      next[emoji] = (next[emoji] ?? 0) + 1;
      setReactions(next);
      setMyReactions([emoji]);
    }
    try {
      await apiFetch(`/api/feed/${postId}/react`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
    } catch {
      setReactions(prevReactions);
      setMyReactions(prevMyReactions);
    }
  }, [reactions, myReactions, apiFetch]);

  async function fetchComments() {
    setCommentsFetchError(false);
    try {
      const res = await apiFetch<{ data: CommentItem[] }>(`/api/feed/${initialPost.id}/comments`);
      setCommentsData(res.data);
      setCommentsFetched(true);
    } catch {
      setCommentsFetchError(true);
    }
  }

  function handleToggleComments(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !openComments;
    setOpenComments(next);
    if (next && !commentsFetched) void fetchComments();
  }

  async function submitComment() {
    const content = commentDraft.trim();
    if (!content || commentSending) return;
    setCommentSending(true);
    const optimisticId = `opt-${Date.now()}`;
    const optimistic: CommentItem = {
      id: optimisticId,
      content,
      createdAt: new Date().toISOString(),
      author: { displayName: dbUser?.displayName ?? user?.displayName ?? "You", avatarUrl: user?.photoURL ?? null },
      replies: [],
    };
    setCommentsData((prev) => [...prev, optimistic]);
    setCommentDraft("");
    setCommentCount((c) => c + 1);
    try {
      const res = await apiFetch<{ data: CommentItem }>(`/api/feed/${initialPost.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setCommentsData((prev) => prev.map((c) => (c.id === optimisticId ? res.data : c)));
    } catch {
      setCommentsData((prev) => prev.filter((c) => c.id !== optimisticId));
      setCommentCount((c) => Math.max(0, c - 1));
      setCommentDraft(content);
    } finally {
      setCommentSending(false);
    }
  }

  async function submitReply(parentId: string) {
    const content = (replyDraft[parentId] ?? "").trim();
    if (!content || replySending[parentId]) return;
    setReplySending((prev) => ({ ...prev, [parentId]: true }));
    const optimisticId = `opt-reply-${Date.now()}`;
    const optimistic: ReplyItem = {
      id: optimisticId,
      content,
      createdAt: new Date().toISOString(),
      parentId,
      author: { displayName: dbUser?.displayName ?? user?.displayName ?? "You", avatarUrl: user?.photoURL ?? null },
    };
    setCommentsData((prev) =>
      prev.map((c) => (c.id === parentId ? { ...c, replies: [...c.replies, optimistic] } : c))
    );
    setReplyDraft((prev) => ({ ...prev, [parentId]: "" }));
    setReplyingTo(null);
    setCommentCount((c) => c + 1);
    try {
      const res = await apiFetch<{ data: ReplyItem }>(`/api/feed/${initialPost.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content, parentId }),
      });
      setCommentsData((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? { ...c, replies: c.replies.map((r) => (r.id === optimisticId ? res.data : r)) }
            : c
        )
      );
    } catch {
      setCommentsData((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? { ...c, replies: c.replies.filter((r) => r.id !== optimisticId) }
            : c
        )
      );
      setCommentCount((c) => Math.max(0, c - 1));
      setReplyDraft((prev) => ({ ...prev, [parentId]: content }));
    } finally {
      setReplySending((prev) => ({ ...prev, [parentId]: false }));
    }
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const visibleComments = showAll ? commentsData : commentsData.slice(-2);
  const hiddenCount = commentsData.length - visibleComments.length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      onClick={() => router.push("/feed")}
      className={`bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow cursor-pointer ${
        initialPost.type === "SHOUTOUT"
          ? "border-l-4 border-l-pink-400 border-zinc-100"
          : "border-zinc-100"
      }`}
    >
      {/* ── Post header ── */}
      <div className="flex gap-3">
        <Link href={`/employees/${initialPost.author.id}`} onClick={(e) => e.stopPropagation()}>
          <Avatar url={initialPost.author.avatarUrl} name={initialPost.author.displayName} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <Link
              href={`/employees/${initialPost.author.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-sm text-zinc-900 hover:underline"
            >
              {initialPost.author.displayName}
            </Link>
            {initialPost.type === "SHOUTOUT" && initialPost.recipient && (
              <>
                <span className="text-xs text-zinc-400">gave a shoutout to</span>
                <Link
                  href={`/employees/${initialPost.recipient.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-sm text-pink-600 hover:underline"
                >
                  {initialPost.recipient.displayName}
                </Link>
              </>
            )}
            <span className="text-xs text-zinc-400 ml-auto shrink-0">
              {postTimestamp(initialPost.createdAt)}
            </span>
          </div>
          <p className="text-sm text-zinc-600 mt-1 line-clamp-3 leading-relaxed">
            {initialPost.content}
          </p>
          {initialPost.imageUrls?.length > 0 &&
            (initialPost.imageUrls.length === 1 ? (
              <div className="mt-2 rounded-lg overflow-hidden bg-white flex items-start justify-start max-h-80">
                <img
                  src={initialPost.imageUrls[0]}
                  alt=""
                  className="max-h-80 w-auto max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
                {initialPost.imageUrls.slice(0, 4).map((url, idx) => (
                  <div key={url} className="relative aspect-square bg-zinc-100 overflow-hidden">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {idx === 3 && initialPost.imageUrls.length > 4 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-sm pointer-events-none">
                        +{initialPost.imageUrls.length - 4}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>

      {/* ── Interaction bar ── */}
      <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
        <ReactionBar
          postId={initialPost.id}
          reactions={reactions}
          myReactions={myReactions}
          onReact={toggleReaction}
        />
        <button
          type="button"
          onClick={handleToggleComments}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            openComments
              ? "bg-navy-50 border-navy-200 text-navy-700"
              : "bg-white border-gray-200 text-gray-500 hover:border-navy-300 hover:text-navy-600"
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {commentCount} {commentCount === 1 ? "comment" : "comments"}
        </button>
      </div>

      {/* ── Comment section ── */}
      {openComments && (
        <div
          className="mt-3 pt-3 border-t border-zinc-100 space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          {commentsFetchError ? (
            <div className="text-xs text-red-500 text-center py-2">
              Failed to load comments.{" "}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fetchComments(); }}
                className="underline hover:text-red-700"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
                  className="text-xs font-semibold text-navy-600 hover:text-navy-800 transition-colors"
                >
                  View {hiddenCount} earlier {hiddenCount === 1 ? "comment" : "comments"}
                </button>
              )}

              {visibleComments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <Avatar name={c.author.displayName} url={c.author.avatarUrl} size="w-7 h-7" />
                  <div className="flex-1 min-w-0">
                    <div className="bg-gray-50 rounded-2xl px-3.5 py-2.5">
                      <span className="text-xs font-semibold text-gray-900">
                        {c.author.displayName}
                      </span>
                      <p className="text-sm text-gray-700 mt-0.5 leading-relaxed whitespace-pre-wrap">
                        {c.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 pl-1">
                      <span className="text-[11px] text-gray-400">{timeAgo(c.createdAt)}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReplyingTo(
                            replyingTo?.commentId === c.id
                              ? null
                              : { commentId: c.id, displayName: c.author.displayName }
                          );
                        }}
                        className="text-[11px] font-semibold text-gray-500 hover:text-navy-600 transition-colors"
                      >
                        Reply
                      </button>
                      {c.replies.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedReplies((prev) => ({ ...prev, [c.id]: !prev[c.id] }));
                          }}
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
                        <Avatar
                          name={user?.displayName ?? "?"}
                          url={user?.photoURL ?? null}
                          size="w-7 h-7"
                        />
                        <div className="flex-1 flex gap-2">
                          <input
                            autoFocus
                            type="text"
                            placeholder={`Reply to ${c.author.displayName}…`}
                            value={replyDraft[c.id] ?? ""}
                            onChange={(e) =>
                              setReplyDraft((prev) => ({ ...prev, [c.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                submitReply(c.id);
                              }
                              if (e.key === "Escape") setReplyingTo(null);
                            }}
                            className="flex-1 text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-400 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => submitReply(c.id)}
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
                            <Avatar
                              name={r.author.displayName}
                              url={r.author.avatarUrl}
                              size="w-7 h-7"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="bg-gray-50 rounded-2xl px-3.5 py-2.5">
                                <span className="text-xs font-semibold text-gray-900">
                                  {r.author.displayName}
                                </span>
                                <p className="text-sm text-gray-700 mt-0.5 leading-relaxed whitespace-pre-wrap">
                                  {r.content}
                                </p>
                              </div>
                              <span className="text-[11px] text-gray-400 mt-1 pl-1 block">
                                {timeAgo(r.createdAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* New comment input */}
              <div className="flex gap-2.5 items-center pt-1">
                <Avatar
                  name={user?.displayName ?? "?"}
                  url={user?.photoURL ?? null}
                  size="w-7 h-7"
                />
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    placeholder="Write a comment…"
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitComment();
                      }
                    }}
                    className="flex-1 text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-400 transition-all"
                  />
                  <button
                    type="button"
                    onClick={submitComment}
                    disabled={commentSending || !commentDraft.trim()}
                    className="flex items-center justify-center w-8 h-8 bg-[#111827] text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
