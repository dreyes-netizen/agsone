"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Avatar } from "./Avatar";
import { MentionDropdown } from "./MentionDropdown";
import { PostMentionText } from "./PostMentionText";
import { useMentionInput, hasMentionTrigger, type MentionEmployee, type MentionInput } from "@/lib/hooks/useMentionInput";
import { GifButton } from "./GifButton";
import { GifPicker } from "./GifPicker";
import { GifCommentMedia } from "./GifCommentMedia";
import { ReactionBar } from "./ReactionBar";
import { getReactionSummary } from "@/lib/helpers/reactionSummary";
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
  onSubmitReply: (postId: string, commentId: string, gif?: GifResult, encodedContent?: string) => void;
  /** React to a comment (parentId omitted) or a reply (parentId = its parent comment's id). */
  onReactToComment: (postId: string, commentId: string, emoji: string, parentId?: string) => void;
  /** Open the "who reacted" modal for a comment or reply. */
  onOpenCommentReactions: (postId: string, commentId: string) => void;
  /** Whether an older page of top-level comments exists behind a cursor. */
  hasMoreComments: boolean;
  /** Whether that older page is currently being fetched. */
  loadingMoreComments: boolean;
  onLoadMoreComments: (postId: string) => void;
  /** Mention candidates. Omit to disable @mentions in replies. */
  employees?: MentionEmployee[];
  /** Called the first time an @ is typed, so the roster can load on demand. */
  onNeedEmployees?: () => void;
  onToggleExpandedReplies: (commentId: string) => void;
  onDeleteComment: (postId: string, commentId: string, parentId?: string) => void;
  autoResize: (el: HTMLTextAreaElement) => void;
  className?: string;
};

/**
 * Arrow/Enter/Escape handling for an open mention dropdown, shared by the
 * comment and reply composers.
 *
 * Returns without touching the event when the list is closed, so Enter still
 * behaves normally in a textarea. Only intercepts while the list is showing.
 */
function handleMentionKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  mention: MentionInput,
  onPick: (emp: MentionEmployee) => void,
) {
  if (!mention.open) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    mention.setActiveIndex((mention.activeIndex + 1) % mention.results.length);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    mention.setActiveIndex((mention.activeIndex - 1 + mention.results.length) % mention.results.length);
  } else if (e.key === "Enter" || e.key === "Tab") {
    const chosen = mention.results[mention.activeIndex];
    if (chosen) {
      e.preventDefault();
      onPick(chosen);
    }
  } else if (e.key === "Escape") {
    // Swallow it so the reply composer's own Escape-to-cancel doesn't also
    // fire and throw away a draft the user was only dismissing a list from.
    e.preventDefault();
    e.stopPropagation();
    mention.close();
  }
}

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
  const router = useRouter();
  return (
    <>
      {item.content && (
        // Rendered through PostMentionText so @[Name|id] tokens become links
        // rather than printing literally — comments previously used a plain
        // {item.content} and had no mention support at all.
        //
        // Navigates directly instead of taking an onMentionClick prop: unlike
        // the post body, which needs the page to close its lightbox first, a
        // comment mention has nothing to tear down.
        <p className="text-sm text-gray-700 mt-0.5 leading-relaxed whitespace-pre-wrap">
          <PostMentionText
            content={item.content}
            onMentionClick={(userId) => router.push(`/employees/${userId}`)}
          />
        </p>
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
  onReactToComment,
  onOpenCommentReactions,
  hasMoreComments,
  loadingMoreComments,
  onLoadMoreComments,
  onToggleExpandedReplies,
  onDeleteComment,
  autoResize,
  className,
  employees = [],
  onNeedEmployees,
}: ListProps) {
  const router = useRouter();
  const goToProfile = (id: string) => router.push(`/employees/${id}`);
  const [replyGif, setReplyGif] = useState<GifResult | null>(null);
  const [replyPickerOpenFor, setReplyPickerOpenFor] = useState<string | null>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  // One instance is enough: only a single reply box is open at a time
  // (replyingTo is a single target, not a set).
  const replyMention = useMentionInput(employees);
  // Batch-resolve every GIF referenced anywhere in this list in one call,
  // rather than one GIPHY round trip per comment.
  const gifIds = useMemo(() => gifIdsOf(comments), [comments]);
  const gifMap = useGifResolution(gifIds);

  function startReply(target: ReplyTarget) {
    onSetReplyingTo(target);
    setReplyGif(null);
    setReplyPickerOpenFor(null);
  }

  function pickReplyMention(commentId: string, emp: MentionEmployee) {
    const el = replyRef.current;
    const draft = replyDraft[commentId] ?? "";
    const cursor = el?.selectionStart ?? draft.length;
    onReplyDraftChange(commentId, replyMention.select(draft, cursor, emp));
    setTimeout(() => el?.focus(), 0);
  }

  function submitReply(commentId: string) {
    onSubmitReply(postId, commentId, replyGif ?? undefined, replyMention.encode(replyDraft[commentId] ?? ""));
    replyMention.reset();
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
      {!loading && hasMoreComments && (
        <div className="flex justify-center pb-1">
          <button
            type="button"
            onClick={() => onLoadMoreComments(postId)}
            disabled={loadingMoreComments}
            className="text-[11px] font-semibold text-navy-500 hover:text-navy-700 transition-colors disabled:opacity-50"
          >
            {loadingMoreComments ? "Loading…" : "View earlier comments"}
          </button>
        </div>
      )}
      {!loading && comments.map((c) => {
        const { total: cTotal, topEmojis: cTopEmojis } = getReactionSummary(c.reactions);
        return (
        <div key={c.id}>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => goToProfile(c.authorId)}
              className="shrink-0 hover:opacity-80 transition-opacity"
              aria-label={`View ${c.author.displayName}'s profile`}
            >
              <Avatar name={c.author.displayName} url={c.author.avatarUrl} size="sm" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="bg-gray-50 rounded-2xl px-3.5 py-2.5">
                <button
                  type="button"
                  onClick={() => goToProfile(c.authorId)}
                  className="text-xs font-semibold text-gray-900 hover:underline transition-colors"
                >
                  {c.author.displayName}
                </button>
                <CommentBody item={c} resolvedGif={c.gifId ? gifMap[c.gifId] : undefined} />
              </div>
              <div className="flex items-center gap-3 mt-1 pl-1">
                <span className="text-[11px] text-gray-500">{timeAgo(c.createdAt)}</span>
                <ReactionBar
                  myReactions={c.myReactions}
                  onReact={(emoji) => onReactToComment(postId, c.id, emoji)}
                  variant="compact"
                />
                {cTotal > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenCommentReactions(postId, c.id)}
                    className="text-[11px] text-gray-500 hover:underline"
                    aria-label={`${cTotal} ${cTotal === 1 ? "reaction" : "reactions"} — view who reacted`}
                  >
                    <span aria-hidden="true">{cTopEmojis.join("")}</span> {cTotal}
                  </button>
                )}
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
                      <div className="relative flex-1">
                        <MentionDropdown
                          mention={replyMention}
                          onSelect={(emp) => pickReplyMention(c.id, emp)}
                        />
                        <textarea
                          ref={replyRef}
                          autoFocus
                          rows={1}
                          placeholder={`Reply to ${c.author.displayName}…`}
                          value={replyDraft[c.id] ?? ""}
                          onChange={(e) => {
                            onReplyDraftChange(c.id, e.target.value);
                            const cur = e.target.selectionStart ?? e.target.value.length;
                            if (hasMentionTrigger(e.target.value, cur)) onNeedEmployees?.();
                            replyMention.detect(e.target.value, cur);
                            autoResize(e.target);
                          }}
                          onKeyDown={(e) => {
                            // The mention handler swallows Escape while its list
                            // is open, so dismissing the list doesn't also
                            // discard the reply draft.
                            handleMentionKeyDown(e, replyMention, (emp) => pickReplyMention(c.id, emp));
                            if (!e.defaultPrevented && e.key === "Escape") startReply(null);
                          }}
                          onBlur={replyMention.close}
                          className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 transition-all resize-none overflow-hidden"
                        />
                      </div>
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
                  {c.replies.map((r) => {
                    const { total: rTotal, topEmojis: rTopEmojis } = getReactionSummary(r.reactions);
                    return (
                    <div key={r.id} className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => goToProfile(r.authorId)}
                        className="shrink-0 hover:opacity-80 transition-opacity"
                        aria-label={`View ${r.author.displayName}'s profile`}
                      >
                        <Avatar name={r.author.displayName} url={r.author.avatarUrl} size="sm" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="bg-gray-50 rounded-2xl px-3.5 py-2.5">
                          <button
                            type="button"
                            onClick={() => goToProfile(r.authorId)}
                            className="text-xs font-semibold text-gray-900 hover:underline transition-colors"
                          >
                            {r.author.displayName}
                          </button>
                          <CommentBody item={r} resolvedGif={r.gifId ? gifMap[r.gifId] : undefined} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 pl-1">
                          <span className="text-[11px] text-gray-500">{timeAgo(r.createdAt)}</span>
                          <ReactionBar
                            myReactions={r.myReactions}
                            onReact={(emoji) => onReactToComment(postId, r.id, emoji, c.id)}
                            variant="compact"
                          />
                          {rTotal > 0 && (
                            <button
                              type="button"
                              onClick={() => onOpenCommentReactions(postId, r.id)}
                              className="text-[11px] text-gray-500 hover:underline"
                              aria-label={`${rTotal} ${rTotal === 1 ? "reaction" : "reactions"} — view who reacted`}
                            >
                              <span aria-hidden="true">{rTopEmojis.join("")}</span> {rTotal}
                            </button>
                          )}
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
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })}
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
  employees = [],
  onNeedEmployees,
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
  /** Mention candidates. Omit to disable @mentions for this composer. */
  employees?: MentionEmployee[];
  /** Called the first time an @ is typed, so the roster can load on demand. */
  onNeedEmployees?: () => void;
  onCommentDraftChange: (postId: string, value: string) => void;
  onSubmitComment: (postId: string, gif?: GifResult, encodedContent?: string) => void;
  autoResize: (el: HTMLTextAreaElement) => void;
  className?: string;
}) {
  const [gif, setGif] = useState<GifResult | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mention = useMentionInput(employees);

  const draft = commentDraft[postId] ?? "";

  function pick(emp: MentionEmployee) {
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? draft.length;
    onCommentDraftChange(postId, mention.select(draft, cursor, emp));
    setTimeout(() => el?.focus(), 0);
  }

  function submit() {
    // Encode picked names into @[Name|id] tokens at send time. The parent owns
    // the draft string, so the encoded text is handed over rather than written
    // back into state first — a setState round trip would race the submit.
    onSubmitComment(postId, gif ?? undefined, mention.encode(draft));
    mention.reset();
    setGif(null);
  }

  return (
    <div className={className ?? "pt-1"}>
      {gif && <AttachedGifPreview gif={gif} onRemove={() => setGif(null)} />}
      <div className="flex gap-2.5 items-center">
        <Avatar name={currentUserName} url={currentUserAvatar} size="sm" />
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <MentionDropdown mention={mention} onSelect={pick} />
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Write a comment…"
              value={draft}
              onChange={(e) => {
                onCommentDraftChange(postId, e.target.value);
                const cur = e.target.selectionStart ?? e.target.value.length;
                if (hasMentionTrigger(e.target.value, cur)) onNeedEmployees?.();
                mention.detect(e.target.value, cur);
                autoResize(e.target);
              }}
              onKeyDown={(e) => handleMentionKeyDown(e, mention, pick)}
              onBlur={mention.close}
              className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 transition-all resize-none overflow-hidden"
            />
          </div>
          <GifButton onClick={() => setPickerOpen(true)} />
          <button
            onClick={submit}
            disabled={commentSending[postId] || (!draft.trim() && !gif)}
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
  onReactToComment,
  onOpenCommentReactions,
  hasMoreComments,
  loadingMoreComments,
  onLoadMoreComments,
  onToggleExpandedReplies,
  onDeleteComment,
  onCommentDraftChange,
  onSubmitComment,
  autoResize,
  wrapperClassName,
  employees = [],
  onNeedEmployees,
}: ListProps & {
  commentDraft: Record<string, string>;
  commentSending: Record<string, boolean>;
  onCommentDraftChange: (postId: string, value: string) => void;
  onSubmitComment: (postId: string, gif?: GifResult, encodedContent?: string) => void;
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
        onReactToComment={onReactToComment}
        onOpenCommentReactions={onOpenCommentReactions}
        hasMoreComments={hasMoreComments}
        loadingMoreComments={loadingMoreComments}
        onLoadMoreComments={onLoadMoreComments}
        onToggleExpandedReplies={onToggleExpandedReplies}
        onDeleteComment={onDeleteComment}
        autoResize={autoResize}
        employees={employees}
        onNeedEmployees={onNeedEmployees}
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
        employees={employees}
        onNeedEmployees={onNeedEmployees}
      />
    </div>
  );
}
