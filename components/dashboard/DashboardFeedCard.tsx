"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Send, SmilePlus, Sparkles } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { timeAgo, postTimestamp } from "@/lib/helpers/timeAgo";
import { ImageLightbox } from "@/components/ImageLightbox";
import { PostImages } from "@/components/feed/PostImages";
import { flairById } from "@/lib/flairs";

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
  title: string | null;
  content: string;
  createdAt: string;
  author: { id: string; displayName: string; avatarUrl: string | null; department: { name: string } | null };
  shoutoutRecipients: { id: string; userId: string; user: { id: string; displayName: string; avatarUrl: string | null } }[];
  flair: string | null;
  reactions: Record<string, number>;
  myReactions: string[];
  commentCount: number;
  imageUrls: string[];
  departmentId: string | null;
  department: { name: string } | null;
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

function renderContent(content: string) {
  const parts = content.split(/(@\[[^|]+\|[^\]]+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^@\[([^|]+)\|([^\]]+)\]$/);
        if (match) {
          return (
            <Link
              key={i}
              href={`/employees/${match[2]}`}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-blue-600 bg-blue-50 rounded px-0.5 hover:bg-blue-100"
            >
              @{match[1]}
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [contentExpanded, setContentExpanded] = useState(false);
  const isLongContent = initialPost.content.length > 180;

  // Re-seed interaction state when this card is reused for a different post
  // (same DOM position, new post id). Keyed on id only — deliberately NOT on the
  // reaction/comment values, so a parent re-render can't clobber an in-flight
  // optimistic update. (Same-id content refresh would need an updatedAt field.)
  useEffect(() => {
    setReactions(initialPost.reactions);
    setMyReactions(initialPost.myReactions);
    setCommentCount(initialPost.commentCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPost.id]);

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
      {initialPost.type === "SHOUTOUT" && initialPost.shoutoutRecipients.length > 0 ? (
        <>
          {/* ── Sender row ── */}
          <div className="flex items-center gap-2 mb-3">
            <Link href={`/employees/${initialPost.author.id}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
              <Avatar url={initialPost.author.avatarUrl} name={initialPost.author.displayName} />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/employees/${initialPost.author.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-sm text-zinc-900 hover:underline whitespace-nowrap min-w-0 truncate">
                  {initialPost.author.displayName}
                </Link>
                <span className="text-xs text-zinc-400 ml-auto shrink-0 whitespace-nowrap">{postTimestamp(initialPost.createdAt)}</span>
              </div>
              {initialPost.author.department && (
                <span className="text-xs text-zinc-400 font-medium block">{initialPost.author.department.name}</span>
              )}
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-amber-200" />
            <span className="text-xs font-semibold text-amber-600 flex items-center gap-1 shrink-0">
              <Sparkles className="w-3.5 h-3.5" /> gave a shoutout to
            </span>
            <div className="h-px flex-1 bg-amber-200" />
          </div>

          {/* ── Recipients + message ── */}
          {initialPost.shoutoutRecipients.length === 1 ? (
            <>
              <div className="flex gap-3 items-start">
                <Link href={`/employees/${initialPost.shoutoutRecipients[0].user.id}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
                  <Avatar url={initialPost.shoutoutRecipients[0].user.avatarUrl} name={initialPost.shoutoutRecipients[0].user.displayName} size="w-12 h-12" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/employees/${initialPost.shoutoutRecipients[0].user.id}`} onClick={(e) => e.stopPropagation()} className="font-bold text-base text-zinc-900 hover:underline block">
                    {initialPost.shoutoutRecipients[0].user.displayName}
                  </Link>
                  <p className={`text-sm text-zinc-600 italic mt-1 leading-relaxed whitespace-pre-wrap ${!contentExpanded && isLongContent ? "line-clamp-3" : ""}`}>
                    &ldquo;{renderContent(initialPost.content)}&rdquo;
                  </p>
                  {isLongContent && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setContentExpanded((v) => !v); }} className="text-xs font-semibold text-navy-600 hover:text-navy-800 mt-0.5">
                      {contentExpanded ? "See less" : "See more"}
                    </button>
                  )}
                </div>
              </div>
              {initialPost.imageUrls?.length > 0 && (
                <div onClick={(e) => e.stopPropagation()}>
                  <PostImages urls={initialPost.imageUrls} onOpen={(idx) => { setLightboxIndex(idx); setLightboxOpen(true); }} />
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {initialPost.shoutoutRecipients.map((r) => (
                  <Link key={r.user.id} href={`/employees/${r.user.id}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-full pl-0.5 pr-2.5 py-0.5 hover:bg-amber-100 transition-colors">
                    <Avatar url={r.user.avatarUrl} name={r.user.displayName} size="w-6 h-6" />
                    <span className="text-xs font-semibold text-amber-900">{r.user.displayName}</span>
                  </Link>
                ))}
              </div>
              <p className={`text-sm text-zinc-600 italic leading-relaxed whitespace-pre-wrap ${!contentExpanded && isLongContent ? "line-clamp-3" : ""}`}>
                &ldquo;{renderContent(initialPost.content)}&rdquo;
              </p>
              {isLongContent && (
                <button type="button" onClick={(e) => { e.stopPropagation(); setContentExpanded((v) => !v); }} className="text-xs font-semibold text-navy-600 hover:text-navy-800">
                  {contentExpanded ? "See less" : "See more"}
                </button>
              )}
              {initialPost.imageUrls?.length > 0 && (
                <div onClick={(e) => e.stopPropagation()}>
                  <PostImages urls={initialPost.imageUrls} onOpen={(idx) => { setLightboxIndex(idx); setLightboxOpen(true); }} />
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {/* ── Flair chips ── */}
          {(initialPost.flair || initialPost.departmentId) && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {initialPost.flair && (() => {
                const flair = flairById[initialPost.flair] ?? flairById["CASUAL"];
                return (
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border w-fit ${flair.color}`}>
                    <span>{flair.emoji}</span>
                    <span>{flair.label}</span>
                  </span>
                );
              })()}
              {initialPost.department && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-navy-100 text-navy-700 border border-navy-200">
                  🏢 {initialPost.department.name} only
                </span>
              )}
            </div>
          )}

          {/* ── Post header ── */}
          <div className="flex items-start gap-3">
            <Link href={`/employees/${initialPost.author.id}`} onClick={(e) => e.stopPropagation()}>
              <Avatar url={initialPost.author.avatarUrl} name={initialPost.author.displayName} />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link href={`/employees/${initialPost.author.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-sm text-zinc-900 hover:underline whitespace-nowrap">
                  {initialPost.author.displayName}
                </Link>
                <span className="text-xs text-zinc-400 ml-auto shrink-0 whitespace-nowrap">
                  {postTimestamp(initialPost.createdAt)}
                </span>
              </div>
              {initialPost.author.department && (
                <span className="text-xs text-zinc-400 font-medium block">{initialPost.author.department.name}</span>
              )}
              {initialPost.title && (
                <p className="text-sm font-bold text-zinc-900 mt-1 leading-snug">{initialPost.title}</p>
              )}
              <p className={`text-sm text-zinc-600 mt-0.5 leading-relaxed whitespace-pre-wrap ${!contentExpanded && isLongContent ? "line-clamp-3" : ""}`}>
                {renderContent(initialPost.content)}
              </p>
              {isLongContent && (
                <button type="button" onClick={(e) => { e.stopPropagation(); setContentExpanded((v) => !v); }} className="text-xs font-semibold text-navy-600 hover:text-navy-800 mt-0.5">
                  {contentExpanded ? "See less" : "See more"}
                </button>
              )}
            </div>
          </div>
          {initialPost.imageUrls?.length > 0 && (
            <div onClick={(e) => e.stopPropagation()}>
              <PostImages urls={initialPost.imageUrls} onOpen={(idx) => { setLightboxIndex(idx); setLightboxOpen(true); }} />
            </div>
          )}
        </>
      )}

      <ImageLightbox
        images={initialPost.imageUrls}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

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
