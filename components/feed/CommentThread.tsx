"use client";

import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { Avatar } from "./Avatar";
import { GifButton } from "./GifButton";
import { GifPicker } from "./GifPicker";
import { GifCommentMedia } from "./GifCommentMedia";
import { timeAgo } from "@/lib/helpers/timeAgo";
import { useGifResolution, type GifMapEntry } from "@/lib/hooks/useGifResolution";
import type { GifResult } from "@/lib/giphy/client";
import type { CommentItem, ReplyItem } from "@/lib/types/feed";

type ReplyTarget = { postId: string; commentId: string; displayName: string } | null;

type ListProps = {
  postId: string;
  comments: CommentItem[];
  loading: boolean;
  replyingTo: ReplyTarget;
  replyDraft: Record<string, string>;
  replySending: Record<string, boolean>;
  expandedReplies: Record<string, boolean>;
  currentUserName: string;
  currentUserAvatar: string | null;
  dbUserId?: string;
  isModerator: boolean;
  onSetReplyingTo: (value: ReplyTarget) => void;
  onReplyDraftChange: (commentId: string, value: string) => void;
  onSubmitReply: (postId: string, commentId: string, gif?: GifResult) => void;
  onToggleExpandedReplies: (commentId: string) => void;
  onDeleteComment: (postId: string, commentId: string, parentId?: string) => void;
  autoResize: (el: HTMLTextAreaElement) => void;
  className?: string;
};

function gifIdsOf(comments: CommentItem[]): string[] {
  const ids: string[] = [];
  for (const c of comments) {
    if (c.commentType === "GIF" && c.gifId) ids.push(c.gifId);
    for (const r of c.replies) {
      if (r.commentType === "GIF" && r.gifId) ids.push(r.gifId);
    }
  }
  return ids;
}

/** A small "attached GIF" preview shown above a composer's textarea, with a
 * way to remove it before sending — text typed alongside is preserved either
 * way (this only ever touches the gif slot, never the draft text). */
function AttachedGifPreview({ gif, onRemove }: { gif: GifResult; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 mb-1.5 pl-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF thumbnail */}
      <img src={gif.thumbUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
      <button
        type="button"
        onClick={onRemove}
        className="text-[11px] font-semibold text-gray-500 hover:text-red-500 transition-colors"
      >
        Remove GIF
      </button>
    </div>
  );
}

function CommentBody({ item, resolvedGif }: { item: CommentItem | ReplyItem; resolvedGif: GifMapEntry }) {
  return (
    <>
      {item.content && (
        <p className="text-sm text-gray-700 mt-0.5 leading-relaxed whitespace-pre-wrap">{item.content}</p>
      )}
      {item.commentType === "GIF" && item.gifId && <GifCommentMedia gif={resolvedGif} />}
    </>
  );
}

/**
 * Just the comment list (with inline reply UI) — no input row. Split out of
 * the combined CommentThread so the media viewer sidebar can put this in its
 * own scrollable region while pinning CommentComposer below it (comment
 * scrolling: the input should never scroll away). The feed card still gets
 * the old combined single-block look via the CommentThread wrapper below.
 */
export function CommentList({
  postId,
  comments,
  loading,
  replyingTo,
  replyDraft,
  replySending,
  expandedReplies,
  currentUserName,
  currentUserAvatar,
  dbUserId,
  isModerator,
  onSetReplyingTo,
  onReplyDraftChange,
  onSubmitReply,
  onToggleExpandedReplies,
  onDeleteComment,
  autoResize,
  className,
}: ListProps) {
  const [replyGif, setReplyGif] = useState<GifResult | null>(null);
  const [replyPickerOpenFor, setReplyPickerOpenFor] = useState<string | null>(null);
  // Batch-resolve every GIF referenced anywhere in this list in one call,
  // rather than one GIPHY round trip per comment.
  const gifIds = useMemo(() => gifIdsOf(comments), [comments]);
  const gifMap = useGifResolution(gifIds);

  function startReply(target: ReplyTarget) {
    onSetReplyingTo(target);
    setReplyGif(null);
    setReplyPickerOpenFor(null);
  }

  function submitReply(commentId: string) {
    onSubmitReply(postId, commentId, replyGif ?? undefined);
    setReplyGif(null);
  }

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-100 rounded w-1/4" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && comments.map((c) => (
        <div key={c.id}>
          <div className="flex gap-2.5">
            <Avatar name={c.author.displayName} url={c.author.avatarUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="bg-gray-50 rounded-2xl px-3.5 py-2.5">
                <span className="text-xs font-semibold text-gray-900">{c.author.displayName}</span>
                <CommentBody item={c} resolvedGif={c.gifId ? gifMap[c.gifId] : undefined} />
              </div>
              <div className="flex items-center gap-3 mt-1 pl-1">
                <span className="text-[11px] text-gray-500">{timeAgo(c.createdAt)}</span>
                <button
                  onClick={() =>
                    startReply(
                      replyingTo?.commentId === c.id
                        ? null
                        : { postId, commentId: c.id, displayName: c.author.displayName }
                    )
                  }
                  className="text-[11px] font-semibold text-gray-500 hover:text-navy-600 transition-colors"
                >
                  Reply
                </button>
                {(c.authorId === dbUserId || isModerator) && (
                  <button
                    onClick={() => onDeleteComment(postId, c.id)}
                    className="text-[11px] font-semibold text-gray-500 hover:text-red-500 transition-colors"
                  >
                    Delete
                  </button>
                )}
                {c.replies.length > 0 && (
                  <button
                    onClick={() => onToggleExpandedReplies(c.id)}
                    className="text-[11px] font-semibold text-navy-500 hover:text-navy-700 transition-colors"
                  >
                    {expandedReplies[c.id]
                      ? "Hide replies"
                      : `View ${c.replies.length} ${c.replies.length === 1 ? "reply" : "replies"}`}
                  </button>
                )}
              </div>
              {replyingTo?.commentId === c.id && (
                <div className="mt-2">
                  {replyGif && (
                    <AttachedGifPreview gif={replyGif} onRemove={() => setReplyGif(null)} />
                  )}
                  <div className="flex gap-2">
                    <Avatar name={currentUserName} url={currentUserAvatar} size="sm" />
                    <div className="flex-1 flex gap-2">
                      <textarea
                        autoFocus
                        rows={1}
                        placeholder={`Reply to ${c.author.displayName}…`}
                        value={replyDraft[c.id] ?? ""}
                        onChange={(e) => { onReplyDraftChange(c.id, e.target.value); autoResize(e.target); }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") startReply(null);
                        }}
                        className="flex-1 text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 transition-all resize-none overflow-hidden"
                      />
                      <GifButton onClick={() => setReplyPickerOpenFor(c.id)} />
                      <button
                        onClick={() => submitReply(c.id)}
                        disabled={replySending[c.id] || (!(replyDraft[c.id] ?? "").trim() && !replyGif)}
                        aria-label="Submit reply"
                        className="flex items-center justify-center w-8 h-8 bg-command-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <GifPicker
                    open={replyPickerOpenFor === c.id}
                    onClose={() => setReplyPickerOpenFor(null)}
                    onSelect={setReplyGif}
                  />
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
                          <CommentBody item={r} resolvedGif={r.gifId ? gifMap[r.gifId] : undefined} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 pl-1">
                          <span className="text-[11px] text-gray-500">{timeAgo(r.createdAt)}</span>
                          {(r.authorId === dbUserId || isModerator) && (
                            <button
                              onClick={() => onDeleteComment(postId, r.id, c.id)}
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
    </div>
  );
}

/**
 * Just the "write a comment…" row — see CommentList above for why this is
 * split out (independent pinning in the media viewer sidebar).
 */
export function CommentComposer({
  postId,
  commentDraft,
  commentSending,
  currentUserName,
  currentUserAvatar,
  onCommentDraftChange,
  onSubmitComment,
  autoResize,
  className,
}: {
  postId: string;
  commentDraft: Record<string, string>;
  commentSending: Record<string, boolean>;
  currentUserName: string;
  currentUserAvatar: string | null;
  onCommentDraftChange: (postId: string, value: string) => void;
  onSubmitComment: (postId: string, gif?: GifResult) => void;
  autoResize: (el: HTMLTextAreaElement) => void;
  className?: string;
}) {
  const [gif, setGif] = useState<GifResult | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  function submit() {
    onSubmitComment(postId, gif ?? undefined);
    setGif(null);
  }

  return (
    <div className={className ?? "pt-1"}>
      {gif && <AttachedGifPreview gif={gif} onRemove={() => setGif(null)} />}
      <div className="flex gap-2.5 items-center">
        <Avatar name={currentUserName} url={currentUserAvatar} size="sm" />
        <div className="flex-1 flex gap-2">
          <textarea
            rows={1}
            placeholder="Write a comment…"
            value={commentDraft[postId] ?? ""}
            onChange={(e) => { onCommentDraftChange(postId, e.target.value); autoResize(e.target); }}
            className="flex-1 text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 transition-all resize-none overflow-hidden"
          />
          <GifButton onClick={() => setPickerOpen(true)} />
          <button
            onClick={submit}
            disabled={commentSending[postId] || (!(commentDraft[postId] ?? "").trim() && !gif)}
            aria-label="Submit comment"
            className="flex items-center justify-center w-8 h-8 bg-command-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <GifPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setGif} />
    </div>
  );
}

/**
 * Feed-card usage: list + composer as one combined block (unchanged visual
 * behavior from before the CommentList/CommentComposer split).
 */
export function CommentThread({
  postId,
  comments,
  loading,
  replyingTo,
  replyDraft,
  replySending,
  expandedReplies,
  commentDraft,
  commentSending,
  currentUserName,
  currentUserAvatar,
  dbUserId,
  isModerator,
  onSetReplyingTo,
  onReplyDraftChange,
  onSubmitReply,
  onToggleExpandedReplies,
  onDeleteComment,
  onCommentDraftChange,
  onSubmitComment,
  autoResize,
  wrapperClassName,
}: ListProps & {
  commentDraft: Record<string, string>;
  commentSending: Record<string, boolean>;
  onCommentDraftChange: (postId: string, value: string) => void;
  onSubmitComment: (postId: string, gif?: GifResult) => void;
  wrapperClassName: string;
}) {
  return (
    <div className={wrapperClassName}>
      <CommentList
        postId={postId}
        comments={comments}
        loading={loading}
        replyingTo={replyingTo}
        replyDraft={replyDraft}
        replySending={replySending}
        expandedReplies={expandedReplies}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        dbUserId={dbUserId}
        isModerator={isModerator}
        onSetReplyingTo={onSetReplyingTo}
        onReplyDraftChange={onReplyDraftChange}
        onSubmitReply={onSubmitReply}
        onToggleExpandedReplies={onToggleExpandedReplies}
        onDeleteComment={onDeleteComment}
        autoResize={autoResize}
      />
      <CommentComposer
        postId={postId}
        commentDraft={commentDraft}
        commentSending={commentSending}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        onCommentDraftChange={onCommentDraftChange}
        onSubmitComment={onSubmitComment}
        autoResize={autoResize}
      />
    </div>
  );
}
